"""FastAPI server for LLM WebUI."""

import asyncio
import json
import subprocess
import tempfile
import os
import shlex
from pathlib import Path
from typing import Optional, List, Dict, Any

import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel


# Pydantic models for API requests
class PromptRequest(BaseModel):
    prompt: str
    model: Optional[str] = None
    system: Optional[str] = None
    attachments: Optional[List[str]] = None
    attachment_types: Optional[List[List[str]]] = None  # [[path, mimetype], ...]
    template: Optional[str] = None
    options: Optional[Dict[str, Any]] = None
    tools: Optional[List[str]] = None
    stream: bool = True
    # Reasoning and provider-specific flags (passed through as -o key=value)
    reasoning: Optional[Dict[str, Any]] = None
    # Extra raw CLI flags, space-separated (e.g. "--raw --no-cache")
    extra_args: Optional[str] = None


class ChatMessage(BaseModel):
    message: str
    model: Optional[str] = None
    conversation_id: Optional[str] = None
    system: Optional[str] = None
    tools: Optional[List[str]] = None
    options: Optional[Dict[str, Any]] = None
    reasoning: Optional[Dict[str, Any]] = None
    extra_args: Optional[str] = None


# FastAPI app
app = FastAPI(title="LLM WebUI", description="Web interface for LLM CLI tool")

# Get the package directory
package_dir = Path(__file__).parent
static_dir = package_dir / "static"
templates_dir = package_dir / "templates"

# Create directories if they don't exist
static_dir.mkdir(exist_ok=True)
templates_dir.mkdir(exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Templates
templates = Jinja2Templates(directory=str(templates_dir))


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Serve the main page."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/models")
async def get_models():
    """Get available models."""
    try:
        result = subprocess.run(
            ["llm", "models", "list", "--json"],
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to get models: {e.stderr}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse models response")


@app.get("/api/templates")
async def get_templates():
    """Get available templates."""
    try:
        result = subprocess.run(
            ["llm", "templates", "list"],
            capture_output=True,
            text=True,
            check=True
        )
        # Parse the simple text output from templates list
        lines = result.stdout.strip().split('\n')
        templates = [line.strip() for line in lines if line.strip()]
        return {"templates": templates}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to get templates: {e.stderr}")


@app.get("/api/tools")
async def get_tools():
    """Get available tools."""
    try:
        result = subprocess.run(
            ["llm", "tools", "list", "--json"],
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tools: {e.stderr}")
    except json.JSONDecodeError:
        return {"tools": []}


@app.post("/api/prompt")
async def execute_prompt(request: PromptRequest):
    """Execute a prompt."""
    cmd = ["llm", "prompt"]
    
    if request.model:
        cmd.extend(["-m", request.model])
    
    if request.system:
        cmd.extend(["-s", request.system])
    
    if request.template:
        cmd.extend(["-t", request.template])
    
    if request.tools:
        for tool in request.tools:
            cmd.extend(["-T", tool])
    
    def add_options(options: Optional[Dict[str, Any]]):
        if not options:
            return
        for key, value in options.items():
            # Use -o KEY VALUE form to avoid equal-sign quoting issues
            cmd.extend(["-o", str(key), str(value)])

    add_options(request.options)
    # Reasoning: pass as a JSON object under key 'reasoning'
    if request.reasoning:
        try:
            cmd.extend(["-o", "reasoning", json.dumps(request.reasoning)])
        except Exception:
            # Fallback: pass individual keys
            add_options(request.reasoning)

    # Attachments: --attachment and --attachment-type path mimetype
    if request.attachments:
        for path in request.attachments:
            cmd.extend(["-a", path])
    if request.attachment_types:
        for path, mimetype in request.attachment_types:
            cmd.extend(["--at", path, mimetype])
    
    # Add the prompt
    # Inject extra flags before the main prompt content
    if request.extra_args:
        try:
            cmd.extend(shlex.split(request.extra_args))
        except Exception:
            pass
    cmd.append(request.prompt)
    
    if request.stream:
        return StreamingResponse(
            stream_llm_response(cmd), 
            media_type="text/plain"
        )
    else:
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            return {"response": result.stdout}
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=500, detail=f"LLM command failed: {e.stderr}")


@app.post("/api/chat")
async def chat_message(message: ChatMessage):
    """Send a chat message."""
    cmd = ["llm", "chat"]
    
    if message.model:
        cmd.extend(["-m", message.model])
    
    if message.conversation_id:
        cmd.extend(["--cid", message.conversation_id])
    
    if message.system:
        cmd.extend(["-s", message.system])
    
    if message.tools:
        for tool in message.tools:
            cmd.extend(["-T", tool])

    def add_options(options: Optional[Dict[str, Any]]):
        if not options:
            return
        for key, value in options.items():
            cmd.extend(["-o", str(key), str(value)])

    add_options(message.options)
    if message.reasoning:
        try:
            cmd.extend(["-o", "reasoning", json.dumps(message.reasoning)])
        except Exception:
            add_options(message.reasoning)
    # Inject extra flags before providing stdin message
    if message.extra_args:
        try:
            cmd.extend(shlex.split(message.extra_args))
        except Exception:
            pass
    
    return StreamingResponse(
        stream_llm_chat_response(cmd, message.message), 
        media_type="text/plain"
    )


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file for use as an attachment."""
    try:
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        return {"filename": file.filename, "path": tmp_path, "size": len(content), "mimetype": file.content_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")


async def stream_llm_response(cmd: List[str]):
    """Stream response from LLM command."""
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            yield line.decode('utf-8')
        
        await process.wait()
        if process.returncode != 0:
            stderr = await process.stderr.read()
            yield f"\nError: {stderr.decode('utf-8')}"
    except Exception as e:
        yield f"\nError: {str(e)}"


async def stream_llm_chat_response(cmd: List[str], message: str):
    """Stream chat response from LLM command."""
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Send the message
        process.stdin.write((message + '\n').encode('utf-8'))
        await process.stdin.drain()
        process.stdin.close()
        
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            yield line.decode('utf-8')
        
        await process.wait()
        if process.returncode != 0:
            stderr = await process.stderr.read()
            yield f"\nError: {stderr.decode('utf-8')}"
    except Exception as e:
        yield f"\nError: {str(e)}"


@app.get("/api/logs")
async def get_logs(count: int = 5):
    """Get recent logs."""
    try:
        result = subprocess.run(
            ["llm", "logs", "list", "-n", str(count), "--json"],
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to get logs: {e.stderr}")
    except json.JSONDecodeError:
        return {"logs": []}


def start_server(host: str = "127.0.0.1", port: int = 8000, reload: bool = False, debug: bool = False):
    """Start the FastAPI server."""
    uvicorn.run(
        "llm_webui.server:app",
        host=host,
        port=port,
        reload=reload,
        log_level="debug" if debug else "info"
    )


@app.get("/api/help")
async def get_help(path: Optional[str] = None):
    """Return help text for the LLM CLI or a subcommand.

    Example: /api/help               -> llm --help
             /api/help?path=prompt   -> llm prompt --help
             /api/help?path=logs list -> llm logs list --help
    """
    parts: List[str] = []
    if path:
        try:
            parts = shlex.split(path)
        except Exception:
            parts = path.split()
    cmd = ["llm", *parts, "--help"]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,  # --help returns 0 but tolerate non-zero
        )
        return {"command": " ".join(cmd), "help": result.stdout or result.stderr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run help: {str(e)}")


@app.get("/api/conversations")
async def list_conversations(limit: int = 50):
    """List conversations from LLM logs (if logging is enabled)."""
    try:
        # Use llm logs list in JSON and then group by conversation_id
        result = subprocess.run(
            ["llm", "logs", "list", "-n", "0", "--json"],
            capture_output=True,
            text=True,
            check=True,
        )
        logs = json.loads(result.stdout)
        convs: Dict[str, Dict[str, Any]] = {}
        for row in logs:
            cid = row.get("conversation_id")
            if not cid:
                # Skip prompts not in a conversation
                continue
            conv = convs.setdefault(
                cid,
                {
                    "conversation_id": cid,
                    "latest": row.get("datetime_utc"),
                    "model": row.get("model"),
                    "count": 0,
                    "last_prompt": row.get("prompt", ""),
                },
            )
            conv["count"] += 1
            # Update latest
            if row.get("datetime_utc") and (
                not conv["latest"] or row.get("datetime_utc") > conv["latest"]
            ):
                conv["latest"] = row.get("datetime_utc")
                conv["last_prompt"] = row.get("prompt", "")
                conv["model"] = row.get("model")

        # Sort by latest desc and limit
        conv_list = sorted(convs.values(), key=lambda x: x["latest"] or "", reverse=True)
        return conv_list[:limit]
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to list conversations: {e.stderr}")
    except json.JSONDecodeError:
        return []


@app.get("/api/conversations/{cid}")
async def get_conversation(cid: str):
    """Return all messages in a conversation."""
    try:
        result = subprocess.run(
            ["llm", "logs", "list", "--cid", cid, "--json"],
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch conversation: {e.stderr}")
    except json.JSONDecodeError:
        return []


@app.post("/api/upload-clipboard")
async def upload_clipboard_image(file: UploadFile = File(...)):
    """Endpoint for clipboard-pasted images from the browser."""
    # This reuses upload_file semantics
    return await upload_file(file)
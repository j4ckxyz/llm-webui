# LLM WebUI

A web-based user interface for the [LLM CLI tool](https://llm.datasette.io/). This plugin provides a modern, responsive web interface that wraps all LLM CLI functionality in an easy-to-use browser-based application.

Status: Alpha (vibe-coded) — expect rough edges while things are iterated quickly.

## Features

- **🚀 Complete LLM CLI Wrapper**: Access all LLM commands through a web interface
- **💬 Interactive Chat Interface**: Real-time streaming chat with conversation history  
- **🤖 Multi-Model Support**: Easy switching between different AI models
- **📎 File Attachments**: Upload images, documents, and other files for multi-modal models
- **🛠️ Tool Integration**: Access and use LLM tools through the web interface
- **📝 Template Management**: Create, view, and use prompt templates
- **📊 Usage Logs**: View and search through your prompt/response history
- **⚡ Real-time Streaming**: Live streaming responses for better user experience
- **📱 Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## Prerequisites

Before installing LLM WebUI, make sure you have:

1. **Python 3.8+** installed on your system
2. **LLM CLI tool** installed and configured:
   ```bash
   pip install llm
   ```
3. At least one model configured (e.g., OpenAI):
   ```bash
   llm keys set openai
   # Enter your OpenAI API key when prompted
   ```

## Installation

### Option 1: Install from PyPI (Recommended)

```bash
pip install llm-webui
```

### Option 2: Install from Source

```bash
git clone https://github.com/j4ckxyz/llm-webui
cd llm-webui
pip install -e .
```

### Option 3: Development Installation

For development or contributing:

```bash
git clone https://github.com/j4ckxyz/llm-webui
cd llm-webui
pip install -e ".[dev]"
```

## Quick Start

1. **Start the web server:**
   ```bash
   llm webui
   ```

2. **Open your browser** to `http://localhost:8000`

3. **Start using LLM** through the web interface!

## Usage

### Starting the Server

Basic usage:
```bash
llm webui
```

Custom host and port:
```bash
llm webui --host 0.0.0.0 --port 8080
```

Development mode with auto-reload:
```bash
llm webui --reload --debug
```

Available options:
- `--host`: Host to bind the server to (default: 127.0.0.1)
- `--port`: Port to bind the server to (default: 8000)  
- `--reload`: Enable auto-reload for development
- `--debug`: Enable debug mode

## Web Interface Features

### 1. Prompt Execution Tab
- **Single Prompt Execution**: Execute one-off prompts with full control over parameters
- **Model Selection**: Choose from all available LLM models  
- **System Prompts**: Add system-level instructions to guide model behavior
- **Template Integration**: Use saved prompt templates for common tasks
- **Tool Access**: Enable specific tools for enhanced model capabilities
- **File Attachments**: Upload images, documents, or other files for multi-modal analysis
- **Clipboard Paste for Images**: Paste images directly (PNG/JPEG) into the attachments area
- **Streaming Responses**: Watch responses appear in real-time
- **Response Export**: Copy or save responses for later use

### 2. Interactive Chat Interface
- **Real-time Conversation**: Chat naturally with AI models
- **Streaming Responses**: See responses as they're generated
- **Conversation Persistence**: Chat history maintained during session
- **Chat Picker Sidebar**: Browse and resume previous conversations from your LLM logs
- **Model Switching**: Change models mid-conversation
- **Tool Integration**: Use tools seamlessly within chat
- **System Prompt Configuration**: Set persistent system instructions for chat
- **Mobile-Friendly**: Optimized for mobile chat experience

### 3. Model Management
- **Model Discovery**: View all available models and their capabilities
- **Model Information**: See model providers, features, and capabilities
- **Easy Switching**: Quick model selection across all interfaces
- **Model Filtering**: Search and filter available models

### 4. Template System
- **Template Library**: Browse all available prompt templates
- **Quick Access**: Use templates directly in prompt execution
- **Template Preview**: See template contents before use

### 5. Usage Logs
- **History Tracking**: View all your previous prompts and responses
- **Search Functionality**: Find specific conversations or prompts
- **Export Options**: Download conversation history
- **Usage Analytics**: See which models and features you use most

Logging behavior: This web UI defers entirely to your LLM CLI logging configuration. If logging is enabled in your CLI (via `llm logs on`), all requests made via the web UI will be written to the same SQLite database. If logging is disabled (`llm logs off`), this UI will not log new requests.

### 6. File Upload & Multi-modal Support
- **Drag & Drop**: Easy file uploading with drag-and-drop interface
- **Multiple Formats**: Support for images, documents, and other file types
- **File Management**: View, remove, and manage uploaded attachments
- **Multi-modal Integration**: Seamlessly use files with compatible models

## Configuration

LLM WebUI inherits all configuration from your existing LLM CLI setup. This includes:

- **API Keys**: All keys configured via `llm keys set` are available
- **Model Aliases**: Custom model aliases work in the web interface  
- **Default Models**: Respects your default model settings
- **Plugin Models**: Any models from LLM plugins are automatically available
- **Logging Settings**: Follows your LLM logging preferences
   - To enable logging of requests from the web UI, run: `llm logs on`

## Troubleshooting

### Common Issues

**Server won't start:**
```bash
# Check if port is already in use
lsof -i :8000

# Try a different port
llm webui --port 8001
```

**Models not loading:**
```bash
# Verify LLM CLI works
llm models list

# Check if you have any models configured
llm keys list
```

**File uploads failing:**
- Ensure you have sufficient disk space
- Check file size limits (default: 10MB per file)
- Verify file format is supported by the selected model

**Streaming not working:**
- Some models don't support streaming
- Check browser console for JavaScript errors
- Try disabling browser extensions

### Debug Mode

Enable debug mode for detailed logging:
```bash
llm webui --debug
```

## Development

### Setting up Development Environment

```bash
git clone https://github.com/j4ckxyz/llm-webui
cd llm-webui
pip install -e ".[dev]"
```

### Screenshots

You can generate screenshots of the UI via a headless browser:

```bash
pip install playwright
python -m playwright install chromium
python scripts/screenshot.py --start-server --port 8765 --out docs/screenshots
```

Generated files will appear under `docs/screenshots/` (e.g., `01_prompt.png`, `02_chat.png`). You can also run against an already running server by omitting `--start-server` and specifying the correct host/port flags.

### Running in Development Mode

```bash
llm webui --reload --debug
```

### Project Structure

```
llm-webui/
├── llm_webui/
│   ├── __init__.py
│   ├── plugin.py          # LLM plugin registration
│   ├── server.py          # FastAPI server
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css  # Custom styles
│   │   └── js/
│   │       └── app.js     # Frontend JavaScript
│   └── templates/
│       └── index.html     # Main HTML template
├── setup.py
└── README.md
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## API Endpoints

The web UI exposes several REST API endpoints that can be used programmatically:

- `GET /api/models` - List available models
- `GET /api/templates` - List available templates  
- `GET /api/tools` - List available tools
- `POST /api/prompt` - Execute a prompt
- `POST /api/chat` - Send a chat message
- `POST /api/upload` - Upload a file
- `GET /api/logs` - Get recent logs
- `GET /api/conversations` - List conversation summaries
- `GET /api/conversations/{cid}` - Get messages for a conversation

## Security Considerations

- The web UI runs locally by default (`127.0.0.1`)
- When exposing to network (`--host 0.0.0.0`), ensure proper firewall rules
- File uploads are stored in temporary directories
- No authentication is built-in - consider using a reverse proxy with auth if needed

## License

MIT License — © 2025 j4ckxyz

## Support

- **Issues**: Report bugs on GitHub Issues
- **Documentation**: Full documentation at the GitHub repository
- **Community**: Join discussions in GitHub Discussions
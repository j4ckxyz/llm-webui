"""LLM WebUI plugin implementation."""

import click
import llm
from .server import start_server


@llm.hookimpl
def register_commands(cli):
    @cli.command(name="webui")
    @click.option(
        "--host", 
        default="127.0.0.1", 
        help="Host to bind the server to"
    )
    @click.option(
        "--port", 
        default=8000, 
        type=int, 
        help="Port to bind the server to"
    )
    @click.option(
        "--reload", 
        is_flag=True, 
        help="Enable auto-reload for development"
    )
    @click.option(
        "--debug", 
        is_flag=True, 
        help="Enable debug mode"
    )
    def webui_command(host, port, reload, debug):
        """Start the LLM Web UI server."""
        click.echo(f"Starting LLM Web UI on http://{host}:{port}")
        start_server(host=host, port=port, reload=reload, debug=debug)
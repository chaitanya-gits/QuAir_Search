import os
import docker
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup Docker client (connects to local Docker Desktop API)
try:
    docker_client = docker.from_env()
except Exception as e:
    print(f"Failed to connect to Docker: {e}")
    docker_client = None

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
# Extremely important: only allow your own Telegram User ID to send commands
ALLOWED_USER_ID = os.getenv("ALLOWED_TELEGRAM_USER_ID", "") 

async def check_auth(update: Update) -> bool:
    """Security check to ensure only you can control your local machine."""
    user_id = str(update.message.from_user.id)
    if ALLOWED_USER_ID and user_id != ALLOWED_USER_ID:
        await update.message.reply_text("⛔ Unauthorized user.")
        return False
    return True

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await check_auth(update): return
    await update.message.reply_text(
        "👋 Welcome! I am your VS Code / Docker Agent.\n\n"
        "Available commands:\n"
        "/status - Check Docker containers\n"
        "/start_tunnel - Start Cloudflare Tunnel to expose localhost:3000\n"
        "Or simply send me a natural language command to process!"
    )

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await check_auth(update): return
    if not docker_client:
        await update.message.reply_text("Docker client not connected. Is Docker Desktop running?")
        return

    try:
        containers = docker_client.containers.list(all=True)
        response = "🐳 **Docker Containers:**\n\n"
        for c in containers:
            state = "🟢" if c.status == "running" else "🔴"
            response += f"{state} {c.name} ({c.status})\n"
        
        await update.message.reply_text(response)
    except Exception as e:
        await update.message.reply_text(f"Error fetching containers: {e}")

async def handle_nlp(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """This is where your 'open claw' / AI Agent logic goes"""
    if not await check_auth(update): return
    user_message = update.message.text
    
    # ---------------------------------------------------------
    # TODO: Integrate your AI Agent here ("Open Claw" / OpenAI / Claude)
    # ---------------------------------------------------------
    # Example flow:
    # 1. Send `user_message` to the LLM.
    # 2. Provide the LLM with "tools" or "functions" like:
    #    - start_container(name="quantum_backend")
    #    - run_shell_script(script="npm run dev")
    #    - start_cloudflare_tunnel(port=3000)
    # 3. LLM replies with the action to take.
    # 4. Execute the action and reply to the user.
    
    await update.message.reply_text(
        f"🤖 Received natural language command: '{user_message}'\n\n"
        "(Agent processing is pending... Connect your AI framework here to parse this and execute the corresponding Docker or Tunnel action!)"
    )

def main() -> None:
    if TELEGRAM_BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("Please set your TELEGRAM_BOT_TOKEN in .env")
        return

    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("status", status))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_nlp))

    print("Starting Telegram Docker Agent... Listening for messages.")
    application.run_polling()

if __name__ == "__main__":
    main()

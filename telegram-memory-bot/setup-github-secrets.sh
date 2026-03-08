#!/bin/bash
# === Setup GitHub Secrets for Telegram Memory Bot ===
# Run this ONCE from your computer to set up the bot
# Prerequisites: gh CLI (install: https://cli.github.com/)

REPO="rloffice-cmd/token-forge-factory"

echo "🔐 Setting up GitHub secrets for Telegram Memory Bot..."

# Set secrets
: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN in your environment before running this script}"
: "${TELEGRAM_OWNER_CHAT_ID:?Set TELEGRAM_OWNER_CHAT_ID in your environment before running this script}"
: "${GEMINI_API_KEY:?Set GEMINI_API_KEY in your environment before running this script}"

gh secret set TELEGRAM_BOT_TOKEN --repo "$REPO" --body "$TELEGRAM_BOT_TOKEN"
gh secret set TELEGRAM_OWNER_CHAT_ID --repo "$REPO" --body "$TELEGRAM_OWNER_CHAT_ID"
gh secret set GEMINI_API_KEY --repo "$REPO" --body "$GEMINI_API_KEY"

echo "✅ Secrets set!"
echo ""
echo "🚀 Triggering the bot workflow..."
gh workflow run telegram-bot.yml --repo "$REPO" --ref "claude/telegram-memory-bot-LphNG"

echo ""
echo "✅ Done! The bot should start within ~30 seconds."
echo "📱 Open Telegram and send /start to your bot."
echo ""
echo "⚠️  IMPORTANT: After verifying the bot works, rotate your tokens:"
echo "   - Get new BOT_TOKEN from @BotFather"
echo "   - Get new GEMINI_API_KEY from https://aistudio.google.com/apikey"
echo "   - Update secrets: gh secret set TELEGRAM_BOT_TOKEN --repo $REPO --body 'NEW_TOKEN'"

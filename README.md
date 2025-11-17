# Loss Found App Bot

一個具備「判斷—選擇—執行」流程的 Discord Bot。它會讀懂每則訊息、先判斷是否值得互動，再決定要不要回覆或僅以表情符號回應。

## Setup

1. **Create a `.env` file:**
    在專案根目錄建立 `.env`，並加入以下環境變數：

    ```javascript
    TOKEN=YOUR_BOT_TOKEN
    CLIENT_ID=YOUR_CLIENT_ID
    GUILD_ID=YOUR_GUILD_ID
    REACTION_EMOJI=OPTIONAL_CUSTOM_EMOJI
    OPENAI_API_KEY=YOUR_OPENAI_KEY
    OPENAI_BASE_URL=https://api.chatanywhere.tech/v1 # optional，未填則使用官方端點
    OPENAI_MODEL=gpt-4o-mini # optional，自訂模型名稱
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Run the bot:**

    ```bash
    npm start
    ```

## How The Bot Decides

- **單一 JSON 指令**：AI 每次回傳 `action` 字段，值只能是 `reply_and_reaction`、`reaction` 或 `ignore`。
- **極低情緒才發言**：當訊息情緒極端低落、求助或直接點名 `lfa` 並表達痛苦時，AI 會輸出 `reply_and_reaction`，Bot 先用繁體中文安撫，再立即按表情符號。
- **一般情緒僅表情**：只要偵測到任何情緒起伏（開心、興奮、生氣…）但未到極低，AI 僅輸出 `reaction`，Bot 只會用表情回應。
- **情緒平穩就忽略**：沒有情緒波動的訊息則得到 `ignore`，Bot 不會說話也不會按表情，避免洗頻。
- **安全退回機制**：若未設定 `OPENAI_API_KEY` 或 AI 呼叫失敗，Bot 會用簡易規則推論——偵測悲傷字詞就回覆+表情、偵測情緒符號就只按表情、否則忽略。

可參考 [取得 OpenAI API](https://github.com/chatanywhere/GPT_API_free) 與 [串接教學](https://www.newspiggy.com/post/how-to-set-openai-chatgpt-api) 設定 `OPENAI_*` 參數。

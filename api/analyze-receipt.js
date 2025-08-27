// api/analyze-receipt.js
// Vercelサーバーレス関数 - OpenAI APIプロキシ

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONSリクエスト処理
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { apiKey, imageBase64 } = req.body;

    if (!apiKey || !imageBase64) {
      res.status(400).json({ error: 'APIキーまたは画像データが不足しています' });
      return;
    }
    
    // 画像形式チェックを追加
if (!imageBase64.startsWith('data:image/')) {
  res.status(400).json({ error: 'Invalid image format' });
  return;
}

const validFormats = ['data:image/png', 'data:image/jpeg', 'data:image/jpg', 'data:image/gif', 'data:image/webp'];
const isValidFormat = validFormats.some(format => imageBase64.startsWith(format));

if (!isValidFormat) {
  res.status(400).json({ error: 'Unsupported image format. Please use PNG, JPEG, GIF, or WEBP.' });
  return;
}

    // OpenAI APIを呼び出し
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            {
              type: "text", 
              text: `このレシートを分析して、商品と金額を抽出し、以下のJSON形式で正確に返してください。
              
              形式:
              [
                {
                  "category": "食費",
                  "amount": 1200,
                  "items": ["商品1", "商品2"]
                }
              ]
              
              カテゴリは以下から選択：
              - 食費（食品、飲料、レストラン）
              - 交通費（電車、バス、ガソリン、タクシー）  
              - ショッピング（衣類、日用品、家電）
              - 娯楽（映画、本、ゲーム、趣味）
              - 光熱費（電気、ガス、水道、通信費）
              - その他（上記以外）
              
              金額は数字のみ、商品名は配列で返してください。`
            },
            {
              type: image_url: {
                    url: imageBase64,
                    detail: "low"
              }
            }
          ]
        }],
        max_tokens: 1500,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI APIエラー:', errorData);
      res.status(response.status).json({ 
        error: `OpenAI API Error: ${response.status}`,
        details: errorData
      });
      return;
    }

    const data = await response.json();
    
    // レスポンス検証
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      res.status(500).json({ error: '予期しないAPIレスポンス形式' });
      return;
    }

    const content = data.choices[0].message.content;
    
    // JSON抽出（コードブロック内の場合も対応）
    let jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      res.status(500).json({ error: 'JSONデータが見つかりません', rawContent: content });
      return;
    }

    try {
      const expenseData = JSON.parse(jsonMatch[0]);
      res.status(200).json({ 
        success: true, 
        data: expenseData,
        usage: data.usage 
      });
    } catch (parseError) {
      res.status(500).json({ 
        error: 'JSON解析エラー',
        rawContent: content,
        parseError: parseError.message
      });
    }

  } catch (error) {
    console.error('サーバーエラー:', error);
    res.status(500).json({ 
      error: 'サーバー内部エラー',
      details: error.message 
    });
  }
}

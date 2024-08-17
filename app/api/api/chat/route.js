import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const systemPrompt = `
You are an AI assistant for an investment app. You can provide information on various investment options, explain investment concepts, and guide users on how to use the app's features. You should be helpful, concise, and avoid giving direct financial advice. Always remind users to consult with a financial advisor for specific investment decisions.
`

export async function POST(req) {
  const openai = new OpenAI()
  const data = await req.json()

  try {
    const completion = await fetchWithRetry(() => openai.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }, ...data],
      model: 'gpt-4',
      stream: true,
    }), 3) // Retry up to 3 times

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content
            if (content) {
              const text = encoder.encode(content)
              controller.enqueue(text)
            }
          }
        } catch (err) {
          controller.error(err)
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(stream)
  } catch (error) {
    console.error('Error:', error)

    // Provide a fallback response if the AI service is unavailable
    const fallbackResponse = {
      role: 'assistant',
      content: "I'm sorry, I encountered an issue and cannot assist you at the moment. Please try again later.",
    }

    return NextResponse.json(fallbackResponse, { status: 500 })
  }
}

// Helper function to implement retry mechanism
async function fetchWithRetry(fetchFn, retries) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchFn()
    } catch (error) {
      if (i === retries - 1) throw error
      console.warn(`Retrying request... (${i + 1}/${retries})`)
    }
  }
}

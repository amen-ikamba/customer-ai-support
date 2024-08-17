"use client"

import { useState, useEffect, useRef } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm the Headstarter support assistant. How can I help you today?",
    },
  ])
  const [message, setMessage] = useState('')
  const [context, setContext] = useState('') // State to hold the context of the conversation
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)
  const contextWindowSize = 5 // Define the sliding window size

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return
    setIsLoading(true)
    setError(null)

    const newMessages = [
      ...messages,
      { role: 'user', content: message },
    ]

    const contextMessages = [
      { role: 'system', content: context }, // Include explicit context if set
      ...newMessages.slice(-contextWindowSize), // Include the last 'contextWindowSize' messages
    ]

    setMessages((messages) => [
      ...messages,
      { role: 'user', content: message },
      { role: 'assistant', content: '' },
    ])

    try {
      const response = await fetchWithRetry('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contextMessages),
      }, 3) // Retry up to 3 times

      if (!response.ok) {
        throw new Error('Failed to fetch the response from the server')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        setMessages((messages) => {
          let lastMessage = messages[messages.length - 1]
          let otherMessages = messages.slice(0, messages.length - 1)
          return [
            ...otherMessages,
            { ...lastMessage, content: lastMessage.content + text },
          ]
        })
      }
    } catch (error) {
      console.error('Error:', error)
      setError('There was an issue with the chat service. Please try again later.')
      setMessages((messages) => [
        ...messages,
        { role: 'assistant', content: "I'm sorry, I encountered an issue and cannot assist you at the moment. Please try again later." },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  const handleContextChange = () => {
    const newContext = prompt('Please enter new context for the conversation:', context)
    if (newContext !== null) {
      setContext(newContext)
    }
  }

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <Stack
        direction={'column'}
        width="500px"
        height="700px"
        border="1px solid black"
        p={2}
        spacing={3}
      >
        <Stack
          direction={'column'}
          spacing={2}
          flexGrow={1}
          overflow="auto"
          maxHeight="100%"
        >
          {messages.map((message, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent={
                message.role === 'assistant' ? 'flex-start' : 'flex-end'
              }
            >
              <Box
                bgcolor={
                  message.role === 'assistant'
                    ? 'primary.main'
                    : 'secondary.main'
                }
                color="white"
                borderRadius={16}
                p={3}
              >
                {message.content}
              </Box>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Stack>
        <Stack direction={'row'} spacing={2}>
          <TextField
            label="Message"
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button
            variant="contained"
            onClick={sendMessage}
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </Stack>
        {error && <Box color="red" mt={2}>{error}</Box>}
        <Box mt={2}>
          <Typography variant="body2" color="textSecondary">
            Context: {context || "None"}
          </Typography>
          <Button variant="outlined" onClick={handleContextChange}>
            Set/Change Context
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}

// Helper function to implement retry mechanism
async function fetchWithRetry(url, options, retries) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options)
      if (!response.ok) throw new Error('Server error')
      return response
    } catch (error) {
      if (i === retries - 1) throw error
      console.warn(`Retrying request... (${i + 1}/${retries})`)
    }
  }
}

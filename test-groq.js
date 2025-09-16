// Test Groq API connection
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function testGroqConnection() {
  try {
    console.log('Testing Groq API connection...');
    console.log('API Key exists:', !!process.env.GROQ_API_KEY);
    console.log('API Key starts with:', process.env.GROQ_API_KEY?.substring(0, 10));
    
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: "Hello! Just testing the connection. Please respond with 'Connection successful!'"
        }
      ],
      model: "llama-3.1-8b-instant", // Try current model
      temperature: 0.1,
      max_tokens: 50,
    });
    
    console.log('✅ Groq API connection successful!');
    console.log('Response:', completion.choices[0]?.message?.content);
    
  } catch (error) {
    console.error('❌ Groq API connection failed:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    
    if (error.status) {
      console.error('HTTP Status:', error.status);
    }
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

testGroqConnection();
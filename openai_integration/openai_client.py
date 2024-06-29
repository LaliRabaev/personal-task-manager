import openai
import os
from openai_integration.response_customizer import ResponseCustomizer

class OpenAI_Client:
    openai.api_key = os.getenv("OPENAI_API_KEY")
    
    @staticmethod
    def generate_response(user_input, user_data, preferences, model):
        conversation_history = [
            {"role": "user", "content": user_input},
            {"role": "assistant", "content": f"My name is {user_data['name']} and I work as a {user_data['job']}."}
        ]
        
        response = openai.chat.completions.create(
            model=model,
            messages=conversation_history
        )
        
        response_text = response.choices[0].message.content.strip()
        return ResponseCustomizer.customize_response(response_text, user_data, preferences)

class ResponseCustomizer:
    @staticmethod
    def customize_response(response, user_data, preferences):
        if preferences.get("response_style") == "detailed":
            response += "\nHere is a more detailed explanation based on your preference."
        return response

package com.auraguide.ai

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.generationConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

data class TourResponse(
    val audioScript: String,
    val routingAction: String?
)

class LlmClient(apiKey: String) {
    private val generativeModel = GenerativeModel(
        modelName = "gemini-pro",
        apiKey = apiKey,
        generationConfig = generationConfig {
            temperature = 0.7f
        }
    )

    suspend fun generateTourResponse(params: TourPromptParams): TourResponse? = withContext(Dispatchers.IO) {
        try {
            val prompt = TourPromptGenerator.generateTourPrompt(params)
            val response = generativeModel.generateContent(prompt)
            
            response.text?.let { jsonStr ->
                val cleanJson = jsonStr.trim().removePrefix("```json").removeSuffix("```").trim()
                val jsonObject = JSONObject(cleanJson)
                
                val script = jsonObject.getString("audio_script")
                val routing = if (jsonObject.has("routing_action") && !jsonObject.isNull("routing_action")) {
                    jsonObject.getString("routing_action")
                } else null
                
                TourResponse(script, routing)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}

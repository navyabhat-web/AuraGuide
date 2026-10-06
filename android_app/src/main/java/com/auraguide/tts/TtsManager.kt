package com.auraguide.tts

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

class TtsManager(context: Context) : TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var isInitialized = false

    init {
        tts = TextToSpeech(context, this)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isInitialized = true
        }
    }

    fun setLanguage(language: String) {
        if (isInitialized) {
            val locale = when(language.lowercase()) {
                "english" -> Locale.US
                "spanish" -> Locale("es", "ES")
                "french" -> Locale.FRANCE
                "german" -> Locale.GERMANY
                else -> Locale.US
            }
            tts?.language = locale
        }
    }

    fun speak(text: String) {
        if (isInitialized) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "TTS_ID")
        }
    }

    fun stop() {
        if (isInitialized) {
            tts?.stop()
        }
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
    }
}

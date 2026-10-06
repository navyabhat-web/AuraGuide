package com.auraguide.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.auraguide.ai.LlmClient
import com.auraguide.ai.TourPromptParams
import com.auraguide.location.LocationData
import com.auraguide.location.LocationTracker
import com.auraguide.tts.TtsManager
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class TourViewModel(application: Application) : AndroidViewModel(application) {
    
    private val locationTracker = LocationTracker(application)
    private val ttsManager = TtsManager(application)
    
    // Replace with your actual Gemini API Key
    private val llmClient = LlmClient("YOUR_GEMINI_API_KEY") 

    val locationData: StateFlow<LocationData> = locationTracker.locationFlow

    private val _isTourActive = MutableStateFlow(false)
    val isTourActive = _isTourActive.asStateFlow()

    private val _currentScript = MutableStateFlow("Waiting for tour to start...")
    val currentScript = _currentScript.asStateFlow()

    private val _routingAlert = MutableStateFlow<String?>(null)
    val routingAlert = _routingAlert.asStateFlow()

    var targetLocation = "Eiffel Tower, Paris"
    var language = "English"
    var personaGender = "Female"
    var personaTone = "Professional Historian"
    
    private var tourJob: Job? = null
    private val visitedLocations = mutableListOf<String>()

    fun toggleTour() {
        if (_isTourActive.value) {
            stopTour()
        } else {
            startTour()
        }
    }

    private fun startTour() {
        _isTourActive.value = true
        locationTracker.startTracking()
        ttsManager.setLanguage(language)
        
        tourJob = viewModelScope.launch {
            while (isActive) {
                generateAndPlayScript()
                // Wait 60 seconds before next narration
                delay(60000) 
            }
        }
    }

    private fun stopTour() {
        _isTourActive.value = false
        locationTracker.stopTracking()
        tourJob?.cancel()
        ttsManager.stop()
        _currentScript.value = "Tour Stopped"
    }

    private suspend fun generateAndPlayScript() {
        val currentLoc = locationData.value
        _currentScript.value = "Generating next narrative..."
        
        val params = TourPromptParams(
            liveGpsLat = currentLoc.latitude,
            liveGpsLng = currentLoc.longitude,
            velocityKmh = currentLoc.speedKmh,
            targetLocationName = targetLocation,
            language = language,
            personaGender = personaGender,
            personaTone = personaTone,
            pastVisitedLocations = visitedLocations.toList(),
            trafficOrWeatherAlerts = null // Or fetch from a weather API
        )

        val response = llmClient.generateTourResponse(params)
        
        if (response != null) {
            _currentScript.value = response.audioScript
            _routingAlert.value = response.routingAction
            
            ttsManager.speak(response.audioScript)
            
            // Periodically add to history for continuity
            if (visitedLocations.size < 5) {
                visitedLocations.add("${currentLoc.latitude},${currentLoc.longitude}")
            }
        } else {
            _currentScript.value = "Error generating script. Retrying..."
        }
    }

    override fun onCleared() {
        super.onCleared()
        locationTracker.stopTracking()
        ttsManager.shutdown()
    }
}

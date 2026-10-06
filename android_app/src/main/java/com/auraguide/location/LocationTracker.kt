package com.auraguide.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import com.google.android.gms.location.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

data class LocationData(
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    val speedKmh: Double = 0.0
)

class LocationTracker(context: Context) {
    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
    
    private val _locationFlow = MutableStateFlow(LocationData())
    val locationFlow: StateFlow<LocationData> = _locationFlow

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.lastLocation?.let { location ->
                val speedMs = if (location.hasSpeed()) location.speed else 0f
                val speedKmh = (speedMs * 3.6).toDouble()
                
                _locationFlow.value = LocationData(
                    latitude = location.latitude,
                    longitude = location.longitude,
                    speedKmh = speedKmh
                )
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun startTracking() {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
            .setMinUpdateIntervalMillis(2000)
            .build()
            
        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        )
    }

    fun stopTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }
}

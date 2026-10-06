package com.auraguide.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TourScreen(viewModel: TourViewModel = viewModel()) {
    val locationData by viewModel.locationData.collectAsState()
    val isTourActive by viewModel.isTourActive.collectAsState()
    val currentScript by viewModel.currentScript.collectAsState()
    val routingAlert by viewModel.routingAlert.collectAsState()

    var targetLocation by remember { mutableStateOf(viewModel.targetLocation) }
    var language by remember { mutableStateOf(viewModel.language) }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("AuraGuide AI Tour", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Settings Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Tour Settings", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = targetLocation,
                        onValueChange = { 
                            targetLocation = it
                            viewModel.targetLocation = it 
                        },
                        label = { Text("Target Landmark/Town") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = language,
                        onValueChange = { 
                            language = it
                            viewModel.language = it 
                        },
                        label = { Text("Language (e.g., English, Spanish)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            // Stats Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Live Telemetry", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Speed: ${String.format(Locale.US, "%.1f", locationData.speedKmh)} km/h")
                    Text("GPS: ${String.format(Locale.US, "%.5f", locationData.latitude)}, ${String.format(Locale.US, "%.5f", locationData.longitude)}")
                }
            }

            // Routing Alert
            if (routingAlert != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Text(
                        text = "ALERT: $routingAlert",
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Script Output
            Card(
                modifier = Modifier.fillMaxWidth(),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Current Narration", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = currentScript,
                        fontSize = 16.sp,
                        lineHeight = 24.sp
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Start/Stop Button
            Button(
                onClick = { viewModel.toggleTour() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isTourActive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                )
            ) {
                Text(
                    text = if (isTourActive) "STOP TOUR" else "START TOUR",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

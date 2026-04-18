package com.example.gatems.ui.viewmodel

import androidx.lifecycle.ViewModel
import com.example.gatems.data.network.RealtimeClient
import com.example.gatems.data.network.RealtimeStatus
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

/**
 * Thin Hilt wrapper that exposes [RealtimeClient.status] to Compose via a ViewModel,
 * so the `ConnectivityBanner` composable can read it without needing a raw singleton.
 */
@HiltViewModel
class RealtimeStatusViewModel @Inject constructor(
    realtimeClient: RealtimeClient,
) : ViewModel() {
    val status: StateFlow<RealtimeStatus> = realtimeClient.status
}

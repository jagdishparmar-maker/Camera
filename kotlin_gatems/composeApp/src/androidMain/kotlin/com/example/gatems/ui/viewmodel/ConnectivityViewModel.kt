package com.example.gatems.ui.viewmodel

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.gatems.data.network.PocketBaseApi
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class ConnectivityStatus { OK, NO_INTERNET, DB_UNREACHABLE }

@HiltViewModel
class ConnectivityViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: PocketBaseApi,
) : ViewModel() {

    private val _status = MutableStateFlow(ConnectivityStatus.OK)
    val status: StateFlow<ConnectivityStatus> = _status.asStateFlow()

    private val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            viewModelScope.launch { doHealthCheck() }
        }
        override fun onLost(network: Network) {
            _status.value = ConnectivityStatus.NO_INTERNET
        }
    }

    init {
        registerNetworkCallback()
        startPeriodicCheck()
    }

    private fun registerNetworkCallback() {
        try {
            val req = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            cm.registerNetworkCallback(req, networkCallback)
        } catch (_: Exception) {}
    }

    private fun startPeriodicCheck() {
        viewModelScope.launch {
            while (true) {
                doHealthCheck()
                delay(15_000L)
            }
        }
    }

    private fun isNetworkConnected(): Boolean =
        cm.getNetworkCapabilities(cm.activeNetwork)
            ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true

    private suspend fun doHealthCheck() {
        if (!isNetworkConnected()) {
            _status.value = ConnectivityStatus.NO_INTERNET
            return
        }
        _status.value = if (api.healthCheck()) ConnectivityStatus.OK
                        else ConnectivityStatus.DB_UNREACHABLE
    }

    fun retry() {
        viewModelScope.launch { doHealthCheck() }
    }

    override fun onCleared() {
        super.onCleared()
        try { cm.unregisterNetworkCallback(networkCallback) } catch (_: Exception) {}
    }
}

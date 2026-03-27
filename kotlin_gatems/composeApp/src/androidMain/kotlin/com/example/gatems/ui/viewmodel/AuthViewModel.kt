package com.example.gatems.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.gatems.data.network.PocketBaseApi
import com.example.gatems.data.network.PocketBaseClient
import com.example.gatems.data.preferences.AuthPreferences
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/** PocketBase built-in auth collection (same as web app). */
private const val USERS_COLLECTION = "users"

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authPrefs: AuthPreferences,
    private val pbClient: PocketBaseClient,
    private val api: PocketBaseApi,
) : ViewModel() {

    private val _sessionReady = MutableStateFlow(false)
    val sessionReady: StateFlow<Boolean> = _sessionReady.asStateFlow()

    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    val userEmail: StateFlow<String> = authPrefs.userEmailFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "")

    val pbUrl: StateFlow<String> = authPrefs.pbUrlFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "")

    init {
        viewModelScope.launch {
            var first = true
            authPrefs.tokenFlow.collect { token ->
                syncClientFromPrefs()
                _isLoggedIn.value = token.isNotBlank()
                if (first) {
                    first = false
                    _sessionReady.value = true
                }
            }
        }
    }

    private suspend fun syncClientFromPrefs() {
        val url = authPrefs.getPbUrl()
        val token = authPrefs.getToken()
        pbClient.init(url, token)
    }

    suspend fun login(email: String, password: String): Result<Unit> = runCatching {
        val resp = api.authWithPassword(USERS_COLLECTION, email.trim(), password)
        authPrefs.saveAuth(
            token = resp.token,
            userId = resp.record.id,
            name = resp.record.name,
            email = resp.record.email,
        )
        pbClient.init(authPrefs.getPbUrl(), resp.token)
    }

    suspend fun logout() {
        authPrefs.clearAuth()
        pbClient.clearToken()
    }
}

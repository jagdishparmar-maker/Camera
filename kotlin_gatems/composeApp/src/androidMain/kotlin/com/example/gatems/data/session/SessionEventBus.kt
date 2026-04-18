package com.example.gatems.data.session

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * One-shot UI messages when the server rejects the session (e.g. expired JWT).
 * Login screen observes [sessionExpiredMessage] to show a notice after redirect.
 */
@Singleton
class SessionEventBus @Inject constructor() {
    private val _sessionExpiredMessage = MutableStateFlow<String?>(null)
    val sessionExpiredMessage: StateFlow<String?> = _sessionExpiredMessage.asStateFlow()

    fun notifySessionExpired(reason: String) {
        _sessionExpiredMessage.value = reason
    }

    fun consumeSessionExpiredMessage() {
        _sessionExpiredMessage.value = null
    }
}

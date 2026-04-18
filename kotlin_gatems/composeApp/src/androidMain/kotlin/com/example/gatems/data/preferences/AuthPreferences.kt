package com.example.gatems.data.preferences

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.example.gatems.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore(name = "gatems_auth")

@Singleton
class AuthPreferences @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    companion object {
        private val KEY_TOKEN      = stringPreferencesKey("auth_token")
        private val KEY_USER_ID    = stringPreferencesKey("user_id")
        private val KEY_USER_NAME  = stringPreferencesKey("user_name")
        private val KEY_USER_EMAIL = stringPreferencesKey("user_email")
        private val KEY_PB_URL     = stringPreferencesKey("pocketbase_url")
        private val KEY_STAY       = booleanPreferencesKey("stay_signed_in")
    }

    val tokenFlow: Flow<String> = context.dataStore.data.map { it[KEY_TOKEN] ?: "" }
    val pbUrlFlow: Flow<String> = context.dataStore.data.map {
        it[KEY_PB_URL] ?: BuildConfig.POCKETBASE_URL
    }
    val userEmailFlow: Flow<String> = context.dataStore.data.map { it[KEY_USER_EMAIL] ?: "" }
    /** True when the user opted into a persistent session at their last login. Default true. */
    val staySignedInFlow: Flow<Boolean> = context.dataStore.data.map { it[KEY_STAY] ?: true }

    suspend fun saveAuth(token: String, userId: String, name: String, email: String) {
        context.dataStore.edit { prefs ->
            prefs[KEY_TOKEN]      = token
            prefs[KEY_USER_ID]    = userId
            prefs[KEY_USER_NAME]  = name
            prefs[KEY_USER_EMAIL] = email
        }
    }

    /** Persist the "Stay signed in" preference toggled on the login screen. */
    suspend fun setStaySignedIn(stay: Boolean) {
        context.dataStore.edit { it[KEY_STAY] = stay }
    }

    suspend fun getStaySignedIn(): Boolean = staySignedInFlow.first()

    /** Clear the auth token only — keeps email + stay preference for UX next launch. */
    suspend fun clearToken() {
        context.dataStore.edit { it.remove(KEY_TOKEN) }
    }

    suspend fun clearAuth() {
        context.dataStore.edit { prefs ->
            prefs.remove(KEY_TOKEN)
            prefs.remove(KEY_USER_ID)
            prefs.remove(KEY_USER_NAME)
            prefs.remove(KEY_USER_EMAIL)
        }
    }

    suspend fun savePbUrl(url: String) {
        context.dataStore.edit { it[KEY_PB_URL] = url.trimEnd('/') }
    }

    suspend fun getToken(): String = tokenFlow.first()
    suspend fun getPbUrl(): String = pbUrlFlow.first()
    suspend fun isLoggedIn(): Boolean = getToken().isNotBlank()

    data class UserInfo(val id: String, val name: String, val email: String)

    suspend fun getUserInfo(): UserInfo = context.dataStore.data.first().let { prefs ->
        UserInfo(
            id    = prefs[KEY_USER_ID]    ?: "",
            name  = prefs[KEY_USER_NAME]  ?: "",
            email = prefs[KEY_USER_EMAIL] ?: "",
        )
    }
}

package com.example.gatems

import android.app.Application
import com.example.gatems.data.network.PocketBaseClient
import com.example.gatems.data.preferences.AuthPreferences
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class GateMsApp : Application() {

    @Inject lateinit var pbClient: PocketBaseClient
    @Inject lateinit var authPrefs: AuthPreferences

    private val appScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        // PocketBaseClient is already seeded with BuildConfig.POCKETBASE_URL.
        // Asynchronously restore any saved auth token + URL override from DataStore.
        appScope.launch {
            val savedUrl   = authPrefs.getPbUrl()
            val savedToken = authPrefs.getToken()
            if (savedUrl.isNotBlank()) pbClient.init(savedUrl, savedToken)
            else if (savedToken.isNotBlank()) pbClient.setToken(savedToken)
        }
    }
}

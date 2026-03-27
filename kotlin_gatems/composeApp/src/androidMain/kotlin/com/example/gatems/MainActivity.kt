package com.example.gatems

import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.gatems.ui.theme.GateMsTheme
import com.example.gatems.ui.navigation.GateMsNavGraph
import com.example.gatems.ui.viewmodel.AuthViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Dark style → status bar and nav bar icons/text rendered in WHITE
        enableEdgeToEdge(
            statusBarStyle     = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        setContent {
            GateMsTheme {
                val authViewModel: AuthViewModel = hiltViewModel()
                GateMsNavGraph(authViewModel = authViewModel)
            }
        }
    }
}

package com.example.gatems.ui.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.gatems.ui.viewmodel.ConnectivityStatus
import com.example.gatems.ui.viewmodel.ConnectivityViewModel

@Composable
fun ConnectivityBanner(
    viewModel: ConnectivityViewModel = hiltViewModel(),
) {
    val status by viewModel.status.collectAsStateWithLifecycle()
    val visible = status != ConnectivityStatus.OK

    AnimatedVisibility(
        visible    = visible,
        enter      = expandVertically(),
        exit       = shrinkVertically(),
    ) {
        val bannerColor = when (status) {
            ConnectivityStatus.NO_INTERNET    -> Color(0xFFCC3300)
            ConnectivityStatus.DB_UNREACHABLE -> Color(0xFF996600)
            ConnectivityStatus.OK             -> Color.Transparent
        }
        val message = when (status) {
            ConnectivityStatus.NO_INTERNET    -> "No internet connection"
            ConnectivityStatus.DB_UNREACHABLE -> "Server unreachable — data may be stale"
            ConnectivityStatus.OK             -> ""
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(bannerColor)
                .padding(horizontal = 16.dp, vertical = 6.dp),
            verticalAlignment     = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
                Icon(
                    imageVector        = Icons.Filled.Warning,
                    contentDescription = null,
                    tint               = Color.White,
                    modifier           = Modifier.size(16.dp),
                )
            Text(
                text     = message,
                style    = MaterialTheme.typography.labelMedium,
                color    = Color.White,
                modifier = Modifier.weight(1f),
            )
            IconButton(
                onClick  = viewModel::retry,
                modifier = Modifier.size(32.dp),
            ) {
                Icon(
                    imageVector        = Icons.Filled.Refresh,
                    contentDescription = "Retry",
                    tint               = Color.White,
                    modifier           = Modifier.size(18.dp),
                )
            }
        }
    }
}

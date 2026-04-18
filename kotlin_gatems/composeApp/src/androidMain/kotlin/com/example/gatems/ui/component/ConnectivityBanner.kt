package com.example.gatems.ui.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.gatems.data.network.RealtimeStatus
import com.example.gatems.ui.viewmodel.ConnectivityStatus
import com.example.gatems.ui.viewmodel.ConnectivityViewModel
import com.example.gatems.ui.viewmodel.RealtimeStatusViewModel
import kotlinx.coroutines.delay

/**
 * Renders the network/server banner *and* (when network is OK) a compact realtime-status pill
 * indicating "Live" / "Reconnecting…". Single composable so screens only need to drop it in once.
 */
@Composable
fun ConnectivityBanner(
    viewModel: ConnectivityViewModel = hiltViewModel(),
    realtimeViewModel: RealtimeStatusViewModel = hiltViewModel(),
) {
    val status by viewModel.status.collectAsStateWithLifecycle()
    val realtimeStatus by realtimeViewModel.status.collectAsStateWithLifecycle()
    val visible = status != ConnectivityStatus.OK

    Column {
        AnimatedVisibility(
            visible    = visible,
            enter      = expandVertically(),
            exit       = shrinkVertically(),
        ) {
            NetworkBanner(status = status, onRetry = viewModel::retry)
        }
        // Only show the realtime pill when the REST side is healthy — otherwise the network
        // banner is already communicating the problem and we don't want to stack warnings.
        if (!visible) {
            RealtimeStatusPill(status = realtimeStatus)
        }
    }
}

@Composable
private fun NetworkBanner(
    status: ConnectivityStatus,
    onRetry: () -> Unit,
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
            imageVector        = Icons.Outlined.Warning,
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
            onClick  = onRetry,
            modifier = Modifier.size(32.dp),
        ) {
            Icon(
                imageVector        = Icons.Outlined.Refresh,
                contentDescription = "Retry",
                tint               = Color.White,
                modifier           = Modifier.size(18.dp),
            )
        }
    }
}

/**
 * Compact pill showing realtime connectivity. Visible only when interesting:
 *  - [RealtimeStatus.CONNECTING] / [RealtimeStatus.RECONNECTING] — amber pulsing pill.
 *  - Briefly (2.5s) when the stream transitions to [RealtimeStatus.LIVE] — green pill, then auto-hides.
 *  - Hidden on [RealtimeStatus.IDLE] and [RealtimeStatus.DISCONNECTED] to keep the chrome quiet.
 */
@Composable
private fun RealtimeStatusPill(status: RealtimeStatus) {
    var showLiveConfirmation by remember { mutableStateOf(false) }
    // Flash a green "Live" confirmation on transitions to LIVE, then auto-dismiss.
    LaunchedEffect(status) {
        if (status == RealtimeStatus.LIVE) {
            showLiveConfirmation = true
            delay(2_500)
            showLiveConfirmation = false
        }
    }

    val shouldShow = status == RealtimeStatus.CONNECTING ||
        status == RealtimeStatus.RECONNECTING ||
        (status == RealtimeStatus.LIVE && showLiveConfirmation)

    AnimatedVisibility(
        visible = shouldShow,
        enter   = fadeIn() + expandVertically(),
        exit    = fadeOut() + shrinkVertically(),
    ) {
        val (bg, dot, label) = when (status) {
            RealtimeStatus.LIVE          -> Triple(Color(0xFF1B5E20), Color(0xFF4CAF50), "Live")
            RealtimeStatus.CONNECTING    -> Triple(Color(0xFF4E342E), Color(0xFFFFB300), "Connecting…")
            RealtimeStatus.RECONNECTING  -> Triple(Color(0xFF4E342E), Color(0xFFFFB300), "Reconnecting…")
            else                         -> Triple(Color.Transparent, Color.Transparent, "")
        }

        val pulse = rememberInfiniteTransition(label = "pill-pulse")
        val pulseAlpha by pulse.animateFloat(
            initialValue = 0.4f,
            targetValue  = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 900),
                repeatMode = RepeatMode.Reverse,
            ),
            label = "pill-pulse-alpha",
        )
        val dotAlpha = if (status == RealtimeStatus.LIVE) 1f else pulseAlpha

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
            verticalAlignment     = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(bg)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .alpha(dotAlpha)
                        .clip(CircleShape)
                        .background(dot),
                )
                Text(
                    text  = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White,
                )
            }
        }
    }
}


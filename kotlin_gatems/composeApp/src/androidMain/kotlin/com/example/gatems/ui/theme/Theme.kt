package com.example.gatems.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

// ── Material 3 dark colour scheme (mirrors appTheme in lib/theme.ts) ─────────
private val GateMsDarkColorScheme = darkColorScheme(
    primary             = Primary,
    onPrimary           = OnPrimary,
    primaryContainer    = PrimaryContainer,
    onPrimaryContainer  = OnPrimaryContainer,
    secondary           = Secondary,
    onSecondary         = OnSecondary,
    secondaryContainer  = SecondaryContainer,
    onSecondaryContainer= OnSecondaryContainer,
    tertiary            = Tertiary,
    onTertiary          = OnTertiary,
    tertiaryContainer   = TertiaryContainer,
    onTertiaryContainer = OnTertiaryContainer,
    background          = Background,
    onBackground        = OnBackground,
    surface             = Surface,
    onSurface           = OnSurface,
    surfaceVariant      = SurfaceVariant,
    onSurfaceVariant    = OnSurfaceVariant,
    outline             = Outline,
    outlineVariant      = OutlineVariant,
    error               = Error,
    onError             = OnError,
    errorContainer      = ErrorContainer,
)

// roundness = 16.dp  ── same as Expo `roundness: 16`
val ShapeTokens = androidx.compose.material3.Shapes(
    extraSmall  = androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
    small       = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
    medium      = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
    large       = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
    extraLarge  = androidx.compose.foundation.shape.RoundedCornerShape(20.dp),
)

@Composable
fun GateMsTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = GateMsDarkColorScheme,
        typography  = GateMsTypography,
        shapes      = ShapeTokens,
        content     = content,
    )
}

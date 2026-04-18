package com.example.gatems.util

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Lightweight haptic feedback wrapper. Chooses the best available `VibrationEffect`
 * per Android version and silently no-ops on devices without a vibrator.
 *
 * For in-composable touch feedback prefer `LocalHapticFeedback.current`; this class
 * is intended for ViewModel-driven confirmations (save/check-out/check-in succeeded,
 * destructive action confirmed, login failed, etc.) where Compose context isn't handy.
 */
@Singleton
class HapticController @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vm?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    /** Short confirmatory tap — use after a successful save / check-in / check-out. */
    fun success() = vibrateEffect(
        predefined = VibrationEffect.EFFECT_CLICK,
        fallback   = longArrayOf(0, 30),
    )

    /** Two-tap error pattern — use for login failure, validation error, rollback. */
    fun error() = vibrateEffect(
        predefined = VibrationEffect.EFFECT_DOUBLE_CLICK,
        fallback   = longArrayOf(0, 25, 60, 25),
    )

    /** Very short tick — use for low-importance confirmations (undo tapped, etc.). */
    fun tick() = vibrateEffect(
        predefined = VibrationEffect.EFFECT_TICK,
        fallback   = longArrayOf(0, 15),
    )

    private fun vibrateEffect(predefined: Int, fallback: LongArray) {
        val v = vibrator?.takeIf { it.hasVibrator() } ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                v.vibrate(VibrationEffect.createPredefined(predefined))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(fallback, -1)
            }
        } catch (_: Throwable) { /* ignore — haptics are never critical */ }
    }
}

package com.example.gatems.util

import java.text.SimpleDateFormat
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale
import java.util.TimeZone

// ── ISO 8601 ──────────────────────────────────────────────────────────────────

private val isoFmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}
private val utcTimeZone = TimeZone.getTimeZone("UTC")
private val istTimeZone = TimeZone.getTimeZone("Asia/Kolkata")

fun Date.toIso(): String = isoFmt.format(this)

fun String.parseIso(): Date? {
    val raw = trim()
    if (raw.isEmpty()) return null

    // First try modern java.time parsing for common ISO variants (with Z / +05:30 etc.)
    runCatching {
        return Date.from(Instant.parse(raw))
    }
    runCatching {
        return Date.from(OffsetDateTime.parse(raw).toInstant())
    }
    runCatching {
        val ldt = LocalDateTime.parse(raw, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS"))
        return Date.from(ldt.atZone(ZoneId.of("UTC")).toInstant())
    }
    runCatching {
        val ldt = LocalDateTime.parse(raw, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
        return Date.from(ldt.atZone(ZoneId.of("UTC")).toInstant())
    }
    runCatching {
        val legacy = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US).apply { timeZone = utcTimeZone }
        return legacy.parse(raw)
    }
    runCatching {
        val legacy = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).apply { timeZone = utcTimeZone }
        return legacy.parse(raw)
    }

    // Fallback legacy parser for app-generated format.
    return try { isoFmt.parse(raw) } catch (_: Exception) { null }
}

// ── Display formatters ────────────────────────────────────────────────────────

/** Long format: "15 Mar 2026, 10:30 AM" */
fun formatDateTimeLong(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    val date = iso.parseIso() ?: return iso
    return SimpleDateFormat("dd MMM, HH:mm", Locale.getDefault()).apply {
        timeZone = istTimeZone
    }.format(date)
}

/** Short format for list cards: "15 Mar, 10:30 AM" */
fun formatDateTimeShort(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    val date = iso.parseIso() ?: return iso
    return SimpleDateFormat("dd MMM, HH:mm", Locale.getDefault()).apply {
        timeZone = istTimeZone
    }.format(date)
}

/** Date-only format: "15 Mar 2026" */
fun formatDate(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    val date = iso.parseIso() ?: return iso
    return SimpleDateFormat("d MMM yyyy", Locale.getDefault()).format(date)
}

/**
 * Human-readable duration between [startIso] and [endIso] (defaults to now).
 * Returns null if [startIso] cannot be parsed.
 * Examples: "3h 20m", "1d 4h", "45m"
 */
fun durationBetween(startIso: String?, endIso: String? = null): String? {
    val start = startIso?.parseIso() ?: return null
    val end   = endIso?.parseIso() ?: Date()
    val diffMs = end.time - start.time
    if (diffMs < 0) return null
    val totalMins  = (diffMs / 60_000).toInt()
    val totalHours = totalMins / 60
    val days       = totalHours / 24
    return when {
        days > 0       -> "${days}d ${totalHours % 24}h"
        totalHours > 0 -> "${totalHours}h ${totalMins % 60}m"
        else           -> "${totalMins}m"
    }
}

package com.example.gatems.ui.component

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DateRange
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.KeyboardArrowUp
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.gatems.data.model.Vehicle
import com.example.gatems.data.model.VehicleStatus
import com.example.gatems.data.model.auditCheckedInByLabel
import com.example.gatems.util.formatDateTimeShort

@Composable
fun VehicleListCard(
    vehicle: Vehicle,
    pbBaseUrl: String,
    onOpenDetail: (Vehicle) -> Unit,
    onCheckOut: (Vehicle) -> Unit,
    /** Show "Check out" button — only when status is DockedOut. */
    showCheckOut: Boolean,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val status  = vehicle.effectiveStatus()
    val imgUrl  = remember(vehicle.id, vehicle.image) { vehicle.imageUrl(pbBaseUrl) }
    val party   = (vehicle.customer?.trim()?.takeIf { it.isNotBlank() }
                  ?: vehicle.driverName?.trim()?.takeIf { it.isNotBlank() }
                  ?: "No customer on file")
    val phone   = vehicle.contactNo?.replace(Regex("[\\s-]"), "")?.trim()

    Card(
        modifier = modifier.fillMaxWidth(),
        shape    = RoundedCornerShape(14.dp),
        colors   = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation= CardDefaults.cardElevation(0.dp),
    ) {
        Column(Modifier.padding(12.dp)) {
            // ── Tap area: thumbnail + details ─────────────────────────────────
            Row(
                modifier          = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenDetail(vehicle) },
                verticalAlignment = Alignment.Top,
            ) {
                // Thumbnail
                if (imgUrl != null) {
                    AsyncImage(
                        model             = imgUrl,
                        contentDescription= "Vehicle photo",
                        contentScale      = ContentScale.Crop,
                        modifier          = Modifier
                            .size(64.dp)
                            .clip(RoundedCornerShape(12.dp)),
                    )
                } else {
                    // Fallback: circle with first letter
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier         = Modifier
                            .size(64.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                    ) {
                        Text(
                            text  = vehicle.vehicleno.take(1).uppercase(),
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }

                Spacer(Modifier.width(12.dp))

                // Details
                Column(Modifier.weight(1f)) {
                    // Vehicle number + status chip
                    Row(
                        modifier          = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text      = vehicle.vehicleno,
                            style     = MaterialTheme.typography.titleMedium,
                            fontWeight= FontWeight.Bold,
                            color     = MaterialTheme.colorScheme.onSurface,
                            maxLines  = 1,
                            overflow  = TextOverflow.Ellipsis,
                            modifier  = Modifier.weight(1f),
                        )
                        StatusChip(status = status)
                    }

                    Spacer(Modifier.height(4.dp))

                    // Customer / driver
                    Text(
                        text     = party,
                        style    = MaterialTheme.typography.bodyMedium,
                        color    = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )

                    Spacer(Modifier.height(6.dp))

                    // Type · Transport
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        val isOutward = vehicle.type == "Outward"
                        Icon(
                            imageVector        = if (isOutward) Icons.Outlined.KeyboardArrowUp else Icons.Outlined.KeyboardArrowDown,
                            contentDescription = null,
                            tint               = MaterialTheme.colorScheme.primary,
                            modifier           = Modifier.size(14.dp),
                        )
                        Text(
                            text     = "${vehicle.type ?: "—"} · ${vehicle.transport?.trim().takeIf { !it.isNullOrBlank() } ?: "—"}",
                            style    = MaterialTheme.typography.bodySmall,
                            color    = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    Spacer(Modifier.height(4.dp))

                    // Check-in time
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            imageVector        = Icons.Outlined.DateRange,
                            contentDescription = null,
                            tint               = MaterialTheme.colorScheme.outline,
                            modifier           = Modifier.size(13.dp),
                        )
                        Text(
                            text     = "In: ${formatDateTimeShort(vehicle.checkInDate)}",
                            style    = MaterialTheme.typography.labelSmall,
                            color    = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    val checkedInBy = vehicle.auditCheckedInByLabel()
                    if (checkedInBy != "—") {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text     = "Checked in by $checkedInBy",
                            style    = MaterialTheme.typography.labelSmall,
                            color    = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    // Dock pill
                    if (vehicle.assignedDock != null) {
                        Spacer(Modifier.height(8.dp))
                        Surface(
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.secondaryContainer,
                        ) {
                            Text(
                                text     = "Dock ${vehicle.assignedDock}",
                                style    = MaterialTheme.typography.labelMedium,
                                color    = MaterialTheme.colorScheme.onSecondaryContainer,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            )
                        }
                    }
                }
            }

            // ── Action row ────────────────────────────────────────────────────
            if (showCheckOut || !phone.isNullOrBlank()) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp), color = MaterialTheme.colorScheme.outlineVariant)
                Row(
                    modifier              = Modifier.fillMaxWidth(),
                    verticalAlignment     = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (showCheckOut) {
                        FilledTonalButton(
                            onClick   = { onCheckOut(vehicle) },
                            modifier  = Modifier.weight(1f),
                            shape     = RoundedCornerShape(10.dp),
                        ) {
                            Text("Check Out")
                        }
                    }
                    if (!phone.isNullOrBlank()) {
                        FilledTonalIconButton(
                            onClick = {
                                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone"))
                                context.startActivity(intent)
                            },
                        ) {
                            Icon(Icons.Outlined.Phone, contentDescription = "Call", modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }
}

// ── Reusable status chip ───────────────────────────────────────────────────────

@Composable
fun StatusChip(status: VehicleStatus, modifier: Modifier = Modifier) {
    Surface(
        shape    = RoundedCornerShape(4.dp),
        color    = status.chipBg(),
        modifier = modifier,
    ) {
        Text(
            text     = status.humanLabel().uppercase(),
            style    = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color    = status.chipText(),
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
        )
    }
}

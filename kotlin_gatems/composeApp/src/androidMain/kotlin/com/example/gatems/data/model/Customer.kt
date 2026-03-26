package com.example.gatems.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Customer(
    val id: String = "",
    @SerialName("customer_name") val customerName: String = "",
)

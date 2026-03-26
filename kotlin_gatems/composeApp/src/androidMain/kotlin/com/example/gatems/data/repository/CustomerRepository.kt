package com.example.gatems.data.repository

import com.example.gatems.data.model.Customer
import com.example.gatems.data.network.PocketBaseApi
import javax.inject.Inject
import javax.inject.Singleton

private const val COLLECTION = "customers"

@Singleton
class CustomerRepository @Inject constructor(private val api: PocketBaseApi) {

    suspend fun getAll(): List<Customer> =
        api.getFullList<Customer>(COLLECTION, sort = "customer_name")
}

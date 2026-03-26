package com.example.gatems.di

import com.example.gatems.data.network.PocketBaseApi
import com.example.gatems.data.network.PocketBaseClient
import com.example.gatems.data.network.RealtimeClient
import com.example.gatems.data.preferences.AuthPreferences
import com.example.gatems.data.repository.CustomerRepository
import com.example.gatems.data.repository.VehicleRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    // PocketBaseClient, PocketBaseApi, RealtimeClient, AuthPreferences,
    // VehicleRepository, and CustomerRepository all use @Inject constructor,
    // so Hilt will create them automatically. This module is reserved for
    // any third-party objects that need manual @Provides wiring.

    // Example: if a future dependency doesn't support @Inject, add @Provides here.
}

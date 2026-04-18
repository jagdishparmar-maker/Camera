import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.hiltAndroid)
    alias(libs.plugins.ksp)
    alias(libs.plugins.kotlinxSerialization)
}

// Read POCKETBASE_URL from local.properties (falls back to emulator localhost)
val localProps = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }
        ?.inputStream()?.use { load(it) }
}
val pbUrl: String = localProps.getProperty("POCKETBASE_URL", "http://10.0.2.2:8090")

kotlin {
    androidTarget {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_11)
        }
    }

    sourceSets {
        androidMain.dependencies {
            implementation(libs.compose.uiToolingPreview)
            implementation(libs.androidx.activity.compose)
            // Material Icons (Home, Settings, etc. for bottom nav + screen actions)
            implementation(libs.androidx.compose.material.icons.core)
            // Full outlined icon set for a smoother, softer look across the app
            implementation(libs.androidx.compose.material.icons.extended)
            // Hilt
            implementation(libs.hilt.android)
            implementation(libs.hilt.navigation.compose)
            // Navigation Compose
            implementation(libs.navigation.compose)
            // Ktor networking
            implementation(libs.ktor.client.android)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.ktor.serialization.json)
            implementation(libs.ktor.client.logging)
            // KotlinX serialization
            implementation(libs.kotlinx.serialization.json)
            // Jetpack DataStore
            implementation(libs.datastore.preferences)
            // Coil image loading
            implementation(libs.coil.compose)
            // OkHttp + SSE for PocketBase realtime
            implementation(libs.okhttp)
            implementation(libs.okhttp.sse)
            // Paging 3 — cursor-based paging for large vehicle lists
            implementation(libs.androidx.paging.runtime)
            implementation(libs.androidx.paging.compose)
        }
        commonMain.dependencies {
            implementation(libs.compose.runtime)
            implementation(libs.compose.foundation)
            implementation(libs.compose.material3)
            implementation(libs.compose.ui)
            implementation(libs.compose.components.resources)
            implementation(libs.compose.uiToolingPreview)
            implementation(libs.androidx.lifecycle.viewmodelCompose)
            implementation(libs.androidx.lifecycle.runtimeCompose)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
        }
    }
}

android {
    namespace = "com.example.gatems"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.example.gatems"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "1.0"
        // Inject PocketBase URL at build time
        buildConfigField("String", "POCKETBASE_URL", "\"$pbUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    debugImplementation(libs.compose.uiTooling)
    // Hilt KSP annotation processor (Android target only)
    add("kspAndroid", libs.hilt.compiler)
    // Kotlin 2.3.0 metadata workaround — Hilt 2.57+ unshades kotlinx-metadata but 2.3.0
    // metadata isn't bundled yet; explicitly providing the newer version resolves it.
    add("kspAndroid", "org.jetbrains.kotlin:kotlin-metadata-jvm:2.3.0")
}

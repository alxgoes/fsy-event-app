import java.io.FileInputStream
import java.util.Properties
import org.gradle.api.GradleException

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) {
        FileInputStream(f).use { load(it) }
    }
}

val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) {
        FileInputStream(f).use { load(it) }
    }
}

val publicSupabaseJsonFile = file("C:/Users/user/Videos/FSY/secrets/android/public-supabase-config.json")
val publicSupabaseJsonText = if (publicSupabaseJsonFile.exists()) publicSupabaseJsonFile.readText() else ""
fun extractJsonStringField(raw: String, field: String): String? {
    val regex = Regex("\"$field\"\\s*:\\s*\"([^\"]+)\"")
    return regex.find(raw)?.groupValues?.getOrNull(1)?.trim()
}

val supabaseUrl = (localProps.getProperty("SUPABASE_URL")
    ?: extractJsonStringField(publicSupabaseJsonText, "supabaseUrl")
    ?: System.getenv("NEXT_PUBLIC_SUPABASE_URL")
    ?: "https://vhbmnnpgftrrovjtvbzo.supabase.co").trim()

val supabaseAnonKey = (localProps.getProperty("SUPABASE_ANON_KEY")
    ?: extractJsonStringField(publicSupabaseJsonText, "supabaseAnonKey")
    ?: System.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    ?: "").trim()

if (supabaseAnonKey.contains("service_role", ignoreCase = true) ||
    supabaseAnonKey.startsWith("sb_secret_", ignoreCase = true)
) {
    throw GradleException("ERRO CRÍTICO DE SEGURANÇA: Chave privilegiada detectada! O APK deve usar exclusivamente chave publicável/anon.")
}

val portalBaseUrl = (localProps.getProperty("PORTAL_BASE_URL")
    ?: extractJsonStringField(publicSupabaseJsonText, "portalBaseUrl")
    ?: System.getenv("NEXT_PUBLIC_SITE_URL")
    ?: "https://fsy-event-app.vercel.app").trim()

val isReleaseBuildRequested = gradle.startParameter.taskNames.any { taskName ->
    taskName.contains("Release", ignoreCase = true)
}

android {
    namespace = "br.com.fsyrp2.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.com.fsyrp2.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 6
        versionName = "1.3.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
        buildConfigField("String", "PORTAL_BASE_URL", "\"$portalBaseUrl\"")
    }

    signingConfigs {
        create("release") {
            val storePath = keystoreProps.getProperty("storeFile")?.trim()
            val storePass = keystoreProps.getProperty("storePassword")?.trim()
            val alias = keystoreProps.getProperty("keyAlias")?.trim()
            val keyPass = keystoreProps.getProperty("keyPassword")?.trim()

            if (!storePath.isNullOrBlank()) {
                storeFile = file(storePath)
                storePassword = storePass
                keyAlias = alias
                keyPassword = keyPass
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            val releaseSigning = signingConfigs.findByName("release")
            val hasValidReleaseKeystore = releaseSigning?.storeFile != null &&
                releaseSigning.storeFile!!.exists() &&
                !releaseSigning.storePassword.isNullOrBlank() &&
                !releaseSigning.keyAlias.isNullOrBlank() &&
                !releaseSigning.keyPassword.isNullOrBlank()

            if (isReleaseBuildRequested) {
                if (supabaseAnonKey.isBlank()) {
                    throw GradleException(
                        "Build release bloqueado (fail-closed): SUPABASE_ANON_KEY (chave publicável) não configurada em local.properties."
                    )
                }
                if (!hasValidReleaseKeystore) {
                    throw GradleException(
                        "Build release bloqueado (fail-closed): keystore de release ausente ou incompleto em keystore.properties."
                    )
                }
            }

            if (hasValidReleaseKeystore) {
                signingConfig = releaseSigning
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
        unitTests.isIncludeAndroidResources = true
        unitTests.all {
            it.maxHeapSize = "2048m"
            it.maxParallelForks = 1
            it.systemProperty("robolectric.pixelCopyRenderMode", "hardware")
            it.systemProperty("roborazzi.test.record", "true")
        }
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

// Os testes deste projeto são JVM/Robolectric. Evita criar uma variante de
// instrumentação vazia e resolver suas dependências no lint. Ao adicionar fontes
// androidTest, a variante volta a ser habilitada automaticamente.
androidComponents {
    beforeVariants(selector().all()) { variant ->
        variant.enableAndroidTest = file("src").listFiles().orEmpty()
            .any { it.isDirectory && it.name.startsWith("androidTest") }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("androidx.glance:glance-appwidget:1.1.1")
    implementation("androidx.glance:glance-material3:1.1.1")

    val firebaseBom = platform("com.google.firebase:firebase-bom:33.5.1")
    implementation(firebaseBom)
    implementation("com.google.firebase:firebase-messaging")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("org.json:json:20231013")
    // Native Compose rendering with synthetic fixtures; excluded from release.
    "testDebugImplementation"("org.robolectric:robolectric:4.14.1")
    "testDebugImplementation"("androidx.test:core:1.6.1")
    "testDebugImplementation"("androidx.test.ext:junit:1.2.1")
    "testDebugImplementation"("androidx.compose.ui:ui-test-junit4")
    "testDebugImplementation"("io.github.takahirom.roborazzi:roborazzi:1.29.0")
    "testDebugImplementation"("io.github.takahirom.roborazzi:roborazzi-compose:1.29.0")
}

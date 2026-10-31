# Preserva classes de serialização Kotlinx e modelos da API FSY
-keepattributes *Annotation*, InnerClasses, Signature
-dontwarn kotlinx.serialization.**
-keepclassmembers class br.com.fsyrp2.app.** {
    *** Companion;
}
-keepclasseswithmembers class br.com.fsyrp2.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}

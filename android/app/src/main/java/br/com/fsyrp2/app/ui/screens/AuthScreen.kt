package br.com.fsyrp2.app.ui.screens

import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.FsyDiscLogo
import br.com.fsyrp2.app.ui.components.FsySectionCard
import br.com.fsyrp2.app.ui.motion.fsyContentSwap
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.fsyPressScale
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette

private enum class AuthMode(val label: String) {
    LOGIN("Entrar"),
    SIGN_UP("Criar conta"),
    RECOVER("Recuperar senha")
}

@Composable
fun AuthScreen(appState: FsyAppState) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val reduceMotion = fsyMotionPreferences().reduceMotion

    var mode by remember { mutableStateOf(AuthMode.LOGIN) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }

    val primaryInteraction = remember { MutableInteractionSource() }
    val googleInteraction = remember { MutableInteractionSource() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Spacer(Modifier.height(8.dp))

            FsyDiscLogo(size = 84.dp)

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Surface(
                    color = FsyPalette.SecondarySunshine,
                    shape = RoundedCornerShape(999.dp)
                ) {
                    Text(
                        text = "FSY 2027 • SESSÃO RIBEIRÃO PRETO 2",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = FsyPalette.DeepText,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                    )
                }

                Text(
                    text = "Alegrar-se em Cristo",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onBackground
                )

                Text(
                    text = "“Alegrai-vos sempre no Senhor; outra vez digo, alegrai-vos.” — Filipenses 4:4",
                    style = MaterialTheme.typography.bodyMedium,
                    fontStyle = FontStyle.Italic,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Text(
                    text = "06 a 10 de fevereiro de 2027 • Ipê Park Hotel • São José do Rio Preto / SP",
                    style = MaterialTheme.typography.labelMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            // Seletor de modo (Entrar / Criar conta / Recuperar senha)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                AuthMode.entries.forEach { tabMode ->
                    val selected = mode == tabMode
                    FilterChip(
                        selected = selected,
                        onClick = {
                            haptics.tick()
                            appState.authError = null
                            appState.authInfoMessage = null
                            mode = tabMode
                        },
                        label = {
                            Text(
                                text = tabMode.label,
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.Center
                            )
                        },
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = 48.dp)
                    )
                }
            }

            if (!appState.authError.isNullOrBlank()) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = appState.authError.orEmpty(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.padding(14.dp)
                    )
                }
            }

            if (!appState.authInfoMessage.isNullOrBlank()) {
                Surface(
                    color = FsyPalette.Success.copy(alpha = 0.14f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = appState.authInfoMessage.orEmpty(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(14.dp)
                    )
                }
            }

            AnimatedContent(
                targetState = mode,
                transitionSpec = { fsyContentSwap(reduceMotion) },
                label = "AuthFormModeSwap"
            ) { currentMode ->
                FsySectionCard {
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        if (currentMode == AuthMode.SIGN_UP) {
                            OutlinedTextField(
                                value = fullName,
                                onValueChange = { fullName = it },
                                label = { Text("Nome completo") },
                                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(
                                    capitalization = KeyboardCapitalization.Words,
                                    imeAction = ImeAction.Next
                                ),
                                modifier = Modifier.fillMaxWidth()
                            )

                            OutlinedTextField(
                                value = unit,
                                onValueChange = { unit = it },
                                label = { Text("Ala ou Ramo / Estaca") },
                                leadingIcon = { Icon(Icons.Default.Place, contentDescription = null) },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(
                                    capitalization = KeyboardCapitalization.Words,
                                    imeAction = ImeAction.Next
                                ),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        OutlinedTextField(
                            value = email,
                            onValueChange = { email = it },
                            label = { Text("E-mail") },
                            leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Email,
                                imeAction = if (currentMode == AuthMode.RECOVER) ImeAction.Done else ImeAction.Next
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        if (currentMode != AuthMode.RECOVER) {
                            OutlinedTextField(
                                value = password,
                                onValueChange = { password = it },
                                label = { Text("Senha") },
                                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                                trailingIcon = {
                                    IconButton(
                                        onClick = { showPassword = !showPassword },
                                        modifier = Modifier.size(48.dp)
                                    ) {
                                        Icon(
                                            imageVector = if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                            contentDescription = if (showPassword) "Ocultar senha" else "Mostrar senha"
                                        )
                                    }
                                },
                                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Password,
                                    imeAction = ImeAction.Done
                                ),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        Button(
                            onClick = {
                                haptics.confirm()
                                when (currentMode) {
                                    AuthMode.LOGIN -> appState.signIn(email, password)
                                    AuthMode.SIGN_UP -> appState.signUp(email, password, fullName, unit)
                                    AuthMode.RECOVER -> appState.requestPasswordRecovery(email)
                                }
                            },
                            enabled = !appState.isAuthenticating,
                            interactionSource = primaryInteraction,
                            modifier = Modifier
                                .fillMaxWidth()
                                .defaultMinSize(minHeight = 52.dp)
                                .fsyPressScale(primaryInteraction)
                        ) {
                            if (appState.isAuthenticating) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.onPrimary
                                )
                                Spacer(Modifier.width(10.dp))
                            }
                            Text(
                                text = when (currentMode) {
                                    AuthMode.LOGIN -> "Entrar no aplicativo"
                                    AuthMode.SIGN_UP -> "Criar minha conta"
                                    AuthMode.RECOVER -> "Enviar link de recuperação"
                                },
                                fontWeight = FontWeight.Bold
                            )
                        }

                        if (currentMode == AuthMode.LOGIN) {
                            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                            OutlinedButton(
                                onClick = {
                                    haptics.confirm()
                                    val oauthUri = appState.buildGoogleOAuthUri()
                                    if (oauthUri != null) {
                                        try {
                                            CustomTabsIntent.Builder()
                                                .setShowTitle(true)
                                                .build()
                                                .launchUrl(context, oauthUri)
                                        } catch (_: Exception) {
                                            appState.authError = "Não foi possível iniciar o navegador seguro para login com Google."
                                        }
                                    }
                                },
                                enabled = !appState.isAuthenticating,
                                interactionSource = googleInteraction,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .defaultMinSize(minHeight = 52.dp)
                                    .fsyPressScale(googleInteraction)
                            ) {
                                Text(
                                    text = "Continuar com Google (OAuth PKCE)",
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

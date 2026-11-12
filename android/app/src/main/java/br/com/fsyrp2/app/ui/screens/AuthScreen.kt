package br.com.fsyrp2.app.ui.screens

import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.FsyActionButton
import br.com.fsyrp2.app.ui.components.FsyButtonTone
import br.com.fsyrp2.app.ui.components.FsyCardShape
import br.com.fsyrp2.app.ui.components.FsyControlShape
import br.com.fsyrp2.app.ui.components.FsyEventFacts
import br.com.fsyrp2.app.ui.components.FsyOfficialMark
import br.com.fsyrp2.app.ui.components.FsyNotice
import br.com.fsyrp2.app.ui.components.FsySegmentedSelector
import br.com.fsyrp2.app.ui.components.FsyStatusBadge
import br.com.fsyrp2.app.ui.components.fsyReveal
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.fsyContentSwap
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.LibreBaskervilleFontFamily

private enum class AuthMode { LOGIN, SIGN_UP, RECOVER }

@Composable
fun AuthScreen(appState: FsyAppState) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val focus = LocalFocusManager.current
    val reduceMotion = fsyMotionPreferences().reduceMotion

    var mode by rememberSaveable { mutableStateOf(AuthMode.LOGIN) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var fullName by rememberSaveable { mutableStateOf("") }
    var unit by rememberSaveable { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }

    fun switchMode(target: AuthMode) {
        haptics.tick()
        appState.authError = null
        appState.authInfoMessage = null
        mode = target
    }

    fun submit(current: AuthMode) {
        haptics.confirm()
        focus.clearFocus()
        when (current) {
            AuthMode.LOGIN -> appState.signIn(email, password)
            AuthMode.SIGN_UP -> appState.signUp(email, password, fullName, unit)
            AuthMode.RECOVER -> appState.requestPasswordRecovery(email)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .imePadding(),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 480.dp)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            // Identidade: único momento focal da app (assenta uma vez, sem laço).
            Column(
                modifier = Modifier.fsyReveal(0),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // Identificador oficial completo (PNG original): placa clara, cantos amplos.
                Surface(
                    color = androidx.compose.ui.graphics.Color.White,
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(28.dp),
                    modifier = Modifier.semantics { heading() },
                ) {
                    FsyOfficialMark(modifier = Modifier.height(188.dp).padding(horizontal = 18.dp, vertical = 14.dp))
                }
                FsyStatusBadge(
                    text = FsyEventFacts.SESSION,
                    backgroundColor = MaterialTheme.colorScheme.secondary,
                    contentColor = MaterialTheme.colorScheme.onSecondary,
                )
                Text(
                    text = "${FsyEventFacts.DATES}\n${FsyEventFacts.VENUE} · ${FsyEventFacts.CITY}",
                    style = MaterialTheme.typography.labelMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Surface(
                shape = FsyCardShape,
                color = MaterialTheme.colorScheme.surface,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                shadowElevation = 2.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .fsyReveal(1),
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    if (mode != AuthMode.RECOVER) {
                        FsySegmentedSelector(
                            options = listOf("Entrar", "Criar conta"),
                            selectedIndex = if (mode == AuthMode.SIGN_UP) 1 else 0,
                            onSelect = { switchMode(if (it == 1) AuthMode.SIGN_UP else AuthMode.LOGIN) },
                        )
                    } else {
                        Text(
                            "Recuperar senha",
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.semantics { heading() },
                        )
                    }

                    val ext = FsyPalette.Extended
                    AnimatedVisibility(visible = !appState.authError.isNullOrBlank()) {
                        FsyNotice(
                            icon = FsyIcons.CircleAlert,
                            text = appState.authError.orEmpty(),
                            container = MaterialTheme.colorScheme.errorContainer,
                            content = MaterialTheme.colorScheme.onErrorContainer,
                        )
                    }
                    AnimatedVisibility(visible = !appState.authInfoMessage.isNullOrBlank()) {
                        FsyNotice(
                            icon = FsyIcons.CircleCheck,
                            text = appState.authInfoMessage.orEmpty(),
                            container = ext.successContainer,
                            content = ext.onSuccessContainer,
                        )
                    }

                    AnimatedContent(
                        targetState = mode,
                        transitionSpec = { fsyContentSwap(reduceMotion) },
                        label = "AuthFormModeSwap",
                    ) { currentMode ->
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            if (currentMode == AuthMode.LOGIN) {
                                // Pílula curta com o "G" oficial de quatro cores (diretrizes de marca do Google).
                                androidx.compose.material3.OutlinedButton(
                                    enabled = !appState.isAuthenticating,
                                    shape = br.com.fsyrp2.app.ui.components.FsyPillShape,
                                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                                    colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(
                                        containerColor = MaterialTheme.colorScheme.surface,
                                        contentColor = MaterialTheme.colorScheme.onSurface,
                                    ),
                                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp, vertical = 10.dp),
                                    modifier = Modifier
                                        .align(Alignment.CenterHorizontally)
                                        .heightIn(min = 48.dp),
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
                                                appState.authError = "Não foi possível abrir o navegador para entrar com Google."
                                            }
                                        }
                                    },
                                ) {
                                    androidx.compose.foundation.Image(
                                        painter = androidx.compose.ui.res.painterResource(br.com.fsyrp2.app.R.drawable.ic_google_g),
                                        contentDescription = null,
                                        modifier = Modifier.size(20.dp),
                                    )
                                    Spacer(Modifier.size(10.dp))
                                    Text("Continuar com Google", style = MaterialTheme.typography.labelLarge)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    HorizontalDivider(Modifier.weight(1f), color = MaterialTheme.colorScheme.outlineVariant)
                                    Text(
                                        "ou com e-mail",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(horizontal = 12.dp),
                                    )
                                    HorizontalDivider(Modifier.weight(1f), color = MaterialTheme.colorScheme.outlineVariant)
                                }
                            }
                            if (currentMode == AuthMode.RECOVER) {
                                Text(
                                    "Enviaremos um link para criar uma nova senha.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            if (currentMode == AuthMode.SIGN_UP) {
                                AuthField(
                                    value = fullName,
                                    onValueChange = { fullName = it },
                                    label = "Nome completo",
                                    icon = FsyIcons.UserRound,
                                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Next),
                                    onNext = { focus.moveFocus(FocusDirection.Down) },
                                )
                                AuthField(
                                    value = unit,
                                    onValueChange = { unit = it },
                                    label = "Ala ou ramo / estaca",
                                    icon = FsyIcons.MapPin,
                                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Next),
                                    onNext = { focus.moveFocus(FocusDirection.Down) },
                                )
                            }
                            AuthField(
                                value = email,
                                onValueChange = { email = it },
                                label = "E-mail",
                                icon = FsyIcons.Mail,
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Email,
                                    imeAction = if (currentMode == AuthMode.RECOVER) ImeAction.Done else ImeAction.Next,
                                ),
                                onNext = { focus.moveFocus(FocusDirection.Down) },
                                onDone = { submit(currentMode) },
                            )
                            if (currentMode != AuthMode.RECOVER) {
                                AuthField(
                                    value = password,
                                    onValueChange = { password = it },
                                    label = "Senha",
                                    icon = FsyIcons.Lock,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                                    onDone = { submit(currentMode) },
                                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                                    trailing = {
                                        IconButton(onClick = { showPassword = !showPassword }, modifier = Modifier.size(48.dp)) {
                                            Icon(
                                                imageVector = if (showPassword) FsyIcons.EyeOff else FsyIcons.Eye,
                                                contentDescription = if (showPassword) "Ocultar senha" else "Mostrar senha",
                                            )
                                        }
                                    },
                                )
                            }
                            if (currentMode == AuthMode.LOGIN) {
                                TextButton(
                                    onClick = { switchMode(AuthMode.RECOVER) },
                                    modifier = Modifier.align(Alignment.End).heightIn(min = 48.dp),
                                ) {
                                    Text("Esqueci a senha", color = FsyPalette.Link, style = MaterialTheme.typography.labelLarge)
                                }
                            }
                            FsyActionButton(
                                label = when (currentMode) {
                                    AuthMode.LOGIN -> "Entrar"
                                    AuthMode.SIGN_UP -> "Criar conta"
                                    AuthMode.RECOVER -> "Enviar link"
                                },
                                icon = when (currentMode) {
                                    AuthMode.RECOVER -> FsyIcons.Mail
                                    else -> FsyIcons.ArrowRight
                                },
                                loading = appState.isAuthenticating,
                                onClick = { submit(currentMode) },
                                modifier = Modifier.fillMaxWidth(),
                            )
                            if (currentMode == AuthMode.RECOVER) {
                                TextButton(
                                    onClick = { switchMode(AuthMode.LOGIN) },
                                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                                ) {
                                    Icon(FsyIcons.ArrowLeft, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.size(6.dp))
                                    Text("Voltar para entrar", style = MaterialTheme.typography.labelLarge)
                                }
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun AuthField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    icon: ImageVector,
    keyboardOptions: KeyboardOptions,
    onNext: () -> Unit = {},
    onDone: () -> Unit = {},
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailing: (@Composable () -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        leadingIcon = { Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp)) },
        trailingIcon = trailing,
        singleLine = true,
        shape = FsyControlShape,
        visualTransformation = visualTransformation,
        keyboardOptions = keyboardOptions,
        keyboardActions = KeyboardActions(onNext = { onNext() }, onDone = { onDone() }),
        colors = OutlinedTextFieldDefaults.colors(
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
            focusedContainerColor = MaterialTheme.colorScheme.surface,
        ),
        modifier = Modifier.fillMaxWidth(),
    )
}

package br.com.fsyrp2.app.ui.screens

import androidx.compose.runtime.Composable
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.FsyProfileButton

/** Mesmo acesso e mesma foto aprovada no topo das telas, inclusive nas camadas da equipe. */
@Composable
internal fun ProfileAccessAction(appState: FsyAppState) {
    FsyProfileButton(
        name = appState.profile?.fullName.orEmpty(),
        photoUrl = appState.profilePhoto.approvedUrl ?: appState.profile?.avatarUrl,
        onClick = { appState.openProfile() },
        onImageError = { appState.refreshProfilePhoto(fromImageError = true) }
    )
}

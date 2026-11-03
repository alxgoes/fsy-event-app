package br.com.fsyrp2.app

import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.network.PortalApiClient
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test
import java.net.ServerSocket
import kotlin.concurrent.thread

class AccountRoleContractTest {
    private val allActions = listOf("edit", "role", "suspend", "reactivate", "delete", "recovery_email", "set_password", "email")
    private val target = AdminAccountDto("synthetic-target", fullName = "Pessoa Fictícia", email = "pessoa@example.invalid")

    @Test fun allThreeManagersCanAssignEveryPortalRoleWhenTheApiPermits() {
        listOf(UserRole.LOGISTICA, UserRole.COORDENADOR, UserRole.CASAL_DIRETOR).forEach { manager ->
            val actions = AccountPermissions.allowedActions(manager, "synthetic-manager", target, allActions)
            assertEquals(UserRole.entries.toList(), AccountPermissions.assignableRoles(manager, actions))
            assertTrue("role" in actions)
            assertFalse("reactivate" in actions)
        }
    }

    @Test fun unknownYouthAndOtherStaffNeverGainAccountActions() {
        (listOf(null) + UserRole.entries.filterNot { it.isManager }).forEach { actor ->
            assertTrue(AccountPermissions.allowedActions(actor, "synthetic-actor", target, allActions).isEmpty())
            assertTrue(AccountPermissions.assignableRoles(actor, setOf("role")).isEmpty())
        }
        assertTrue(AccountPermissions.allowedActions(UserRole.LOGISTICA, null, target, allActions).isEmpty())
    }

    @Test fun serverActionsAreRequiredAndSelfRestrictionsStayInPlace() {
        assertTrue(AccountPermissions.allowedActions(UserRole.LOGISTICA, "synthetic-manager", target, emptyList()).isEmpty())
        val self = AccountPermissions.allowedActions(UserRole.LOGISTICA, target.id, target, allActions + "unknown-action")
        assertEquals(setOf("edit", "recovery_email", "email"), self)
        assertTrue(AccountPermissions.assignableRoles(UserRole.LOGISTICA, self).isEmpty())
        val noEmailSuspended = target.copy(email = null, suspended = true, status = "suspenso")
        val restricted = AccountPermissions.allowedActions(UserRole.LOGISTICA, "synthetic-manager", noEmailSuspended, allActions)
        assertTrue("reactivate" in restricted)
        assertFalse("suspend" in restricted)
        assertFalse("email" in restricted)
        assertFalse("recovery_email" in restricted)
    }

    @Test fun accountsClientRetainsServerPermissionsAndPortugueseNames() = runTest {
        val server = ServerSocket(0)
        var requestHeaders = ""
        val worker = thread(isDaemon = true) {
            server.accept().use { client ->
                val input = client.getInputStream()
                val header = StringBuilder()
                while (!header.endsWith("\r\n\r\n")) {
                    val next = input.read()
                    if (next < 0) break
                    header.append(next.toChar())
                }
                requestHeaders = header.toString()
                val body = """{"data":[{"id":"synthetic-target","full_name":"Pessoa Fictícia","role":"jovem","email":"pessoa@example.invalid"}],"permissions":{"synthetic-target":["edit","role"]},"total":1,"page":1,"per_page":25}""".toByteArray(Charsets.UTF_8)
                client.getOutputStream().apply {
                    write("HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray())
                    write(body); flush()
                }
            }
        }
        try {
            val base = "http://127.0.0.1:${server.localPort}"
            val api = PortalApiClient(base, "public-test", base)
            val result = api.fetchAdminAccounts(UserSession("test-token", "test-refresh", userId = "synthetic-manager"), role = "midia")
            assertEquals("Pessoa Fictícia", result.accounts.single().fullName)
            assertEquals(listOf("edit", "role"), result.permissions["synthetic-target"])
            assertTrue(requestHeaders.startsWith("GET /api/admin/accounts?"))
            assertTrue(requestHeaders.contains("role=midia"))
            assertTrue(requestHeaders.contains("Authorization: Bearer test-token", ignoreCase = true))
        } finally { server.close(); worker.join(1000) }
    }
}

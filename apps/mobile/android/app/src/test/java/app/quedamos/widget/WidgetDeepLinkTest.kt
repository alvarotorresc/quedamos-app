package app.quedamos.widget

import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetDeepLinkTest {

    @Test
    fun `el deep link del calendario apunta al host público con el groupId`() {
        assertEquals(
            "https://quedamos.alvarotc.com/tabs/calendar?groupId=abc-123",
            WidgetDeepLink.calendar("abc-123"),
        )
    }
}

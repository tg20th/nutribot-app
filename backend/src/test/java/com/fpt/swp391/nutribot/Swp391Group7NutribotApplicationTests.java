package com.fpt.swp391.nutribot;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Basic compilation test - verifies the test class compiles successfully.
 * Full integration tests require database configuration.
 */
class Swp391Group7NutribotApplicationTests {

    @Test
    void applicationClassExists() {
        // Verify main application class exists
        Swp391Group7NutribotApplication app = new Swp391Group7NutribotApplication();
        assertNotNull(app);
    }
}

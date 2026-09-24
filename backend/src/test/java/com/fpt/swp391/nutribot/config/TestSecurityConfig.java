package com.fpt.swp391.nutribot.config;

import com.fpt.swp391.nutribot.repository.RoleRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.mockito.Mockito.mock;

@TestConfiguration
public class TestSecurityConfig {

    @Bean
    @Primary
    public UserRepository userRepository() {
        return mock(UserRepository.class);
    }

    @Bean
    @Primary
    public RoleRepository roleRepository() {
        return mock(RoleRepository.class);
    }

    @Bean
    @Primary
    public PasswordEncoder passwordEncoder() {
        return mock(PasswordEncoder.class);
    }
}

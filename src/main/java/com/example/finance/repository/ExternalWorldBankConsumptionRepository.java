package com.example.finance.repository;

import com.example.finance.entity.ExternalWorldBankConsumption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ExternalWorldBankConsumptionRepository extends JpaRepository<ExternalWorldBankConsumption, Long> {

    List<ExternalWorldBankConsumption> findByCountryIso3OrderByPeriodYearAsc(String countryIso3);

    @Query("""
            select distinct e.countryIso3
            from ExternalWorldBankConsumption e
            where e.countryIso3 is not null
            order by e.countryIso3 asc
            """)
    List<String> listCountries();

    Optional<ExternalWorldBankConsumption> findTopByCountryIso3OrderByPeriodYearDesc(String countryIso3);
}

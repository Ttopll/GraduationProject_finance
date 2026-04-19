package com.example.finance.repository;

import com.example.finance.entity.ExternalRetailTransaction;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;

public interface ExternalRetailTransactionRepository extends JpaRepository<ExternalRetailTransaction, Long> {

    @Query("""
            select count(r), coalesce(sum(r.amount), 0), coalesce(avg(r.amount), 0), min(r.invoiceTime), max(r.invoiceTime)
            from ExternalRetailTransaction r
            """)
    List<Object[]> summaryRows();

    @Query("""
            select r.country as country, count(r) as recordCount, coalesce(sum(r.amount), 0) as totalAmount
            from ExternalRetailTransaction r
            where r.country is not null and r.country <> ''
            group by r.country
            order by totalAmount desc
            """)
    List<CountryAmountRow> topCountryRows(Pageable pageable);

    interface CountryAmountRow {
        String getCountry();

        Long getRecordCount();

        BigDecimal getTotalAmount();
    }
}

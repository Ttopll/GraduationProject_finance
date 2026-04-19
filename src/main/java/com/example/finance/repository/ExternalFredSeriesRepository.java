package com.example.finance.repository;

import com.example.finance.entity.ExternalFredSeries;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExternalFredSeriesRepository extends JpaRepository<ExternalFredSeries, Long> {

    List<ExternalFredSeries> findBySeriesIdOrderByMetricDateAsc(String seriesId);
}

<?php

$hasDate = !empty($date);
        $currentDate = $hasDate ? \DateTime::createFromFormat('d/m/Y', $date) : new \DateTime();

        $realDate = [
			'day' => (int) $currentDate->format('d'),
			'week' => (int) $currentDate->format('W'),
			'month' => (int) $currentDate->format('m'),
			'year' => (int) $currentDate->format('Y')
        ];

        $date = [];

        // Tax months start at 6th April so calculate offset
        // and use that to get tax date

        $masterMonth = 4; // April
        $masterDay = 4; // 6th

        $monthOffset = $realDate['month'] - $masterMonth;
        $dayOffset = $realDate['day'] - $masterDay;

        $date['month_offset_before'] = $monthOffset;

        $date['real_month'] = $realDate['month'];
        $date['real_month_name'] = $currentDate->format('M');
        $date['real_year'] = $realDate['year'];

        if ($monthOffset <= 0) {
            $monthOffset = $masterMonth - $realDate['month'];
            $date['year'] = $realDate['year'] - 1;

            if ($realDate['day'] < $masterDay) {
                // still in previous tax year
                $date['month'] = (12 - $monthOffset);
            }
            else {
                $date['month'] = (12 - $monthOffset) + 1;
            }
        }
        else {
            $date['year'] = $realDate['year'];

            if ($realDate['day'] >= $masterDay) {
                $date['month'] = $monthOffset + 1;
            }
            else {
                $date['month'] = $monthOffset;
            }
        }

        if ($dayOffset < 0) {
            // still in previous tax month
            $date['day'] = (31 + $dayOffset) + 1;
        }
        else {
            $date['day'] = $dayOffset + 1;
        }

        if ($date['month'] > 12) {
            $date['month'] = 1;
            $date['year'] += 1;
        }

        $date['month_offset_after'] = $monthOffset;

        $weekMonthDate = \DateTime::createFromFormat('d/m/Y', $masterDay . '/' . $masterMonth . '/' . $realDate['year']);

        if ($realDate['month'] <= $masterMonth) {
            if ($realDate['day'] < $masterDay || $realDate['month'] < $masterMonth) {
                $weekMonthDate->modify('-1 year');
            }
        }

        $weekDiff = $currentDate->getTimestamp() - $weekMonthDate->getTimestamp();
        $weekOffset = floor($weekDiff / 604800);

        $date['week'] = $weekOffset + 1;

        $taxDate = \DateTime::createFromFormat('d/m/Y', '6/4/' . $realDate['year']);
        $taxDate->modify('+' . ($date['month'] - 1) . ' months');

        $date['tax_month_name'] = $taxDate->format('M');

        print_r($date);
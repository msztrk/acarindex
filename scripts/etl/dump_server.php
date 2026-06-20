<?php
set_time_limit(590);
ini_set('memory_limit', '4096M');

$outFile = '/home/acarinde/dump_etl.sql';
$fp = fopen($outFile, 'w');

try {
    $pdo = new PDO(
        'mysql:host=localhost;dbname=acarinde_yeniacarindex;charset=utf8mb4',
        'acarinde_yeniacarindex',
        'c,0nGr_,93vl',
        [PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4', PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $tables = ['kategoriler','dergiler','dergi_arsiv','makaleler','yazarlar','uyeler','dergibasvuru'];

    fwrite($fp, "-- Acarindex ETL Dump\n-- Date: " . date('Y-m-d H:i:s') . "\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n");

    foreach ($tables as $table) {
        $create = $pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM);
        fwrite($fp, "-- Table: $table\nDROP TABLE IF EXISTS `$table`;\n" . $create[1] . ";\n\n");

        $stmt = $pdo->query("SELECT * FROM `$table`");
        $batch = [];
        $batchSize = 200;
        $colNames = null;

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if ($colNames === null) {
                $colNames = '`' . implode('`, `', array_keys($row)) . '`';
            }
            $escaped = array_map(function ($v) use ($pdo) {
                return $v === null ? 'NULL' : $pdo->quote($v);
            }, $row);
            $batch[] = '(' . implode(', ', $escaped) . ')';

            if (count($batch) >= $batchSize) {
                fwrite($fp, "INSERT INTO `$table` ($colNames) VALUES\n" . implode(",\n", $batch) . ";\n");
                $batch = [];
            }
        }
        if ($batch) {
            fwrite($fp, "INSERT INTO `$table` ($colNames) VALUES\n" . implode(",\n", $batch) . ";\n");
        }
        fwrite($fp, "\n");
    }

    fwrite($fp, "SET FOREIGN_KEY_CHECKS=1;\n");
    fclose($fp);
    echo 'DONE: ' . filesize($outFile) . ' bytes';

} catch (Exception $e) {
    fclose($fp);
    echo 'ERR: ' . $e->getMessage();
}

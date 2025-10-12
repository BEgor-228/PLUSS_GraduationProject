<?php
/**
 * Класс-обертка для безопасной работы с PDO.
 * Использует singleton для единственного соединения.
 * Все запросы через prepared statements.
 */
require_once __DIR__ . '/../config/database.php';

class Database {
    private static $instance = null;

    /**
     * Получить singleton-инстанс PDO.
     */
    public static function getInstance() {
        if (self::$instance === null) {
            global $pdo;
            self::$instance = $pdo;
        }
        return self::$instance;
    }

    /**
     * Выполнить SELECT-запрос и вернуть массив результатов.
     * @param string $sql SQL с плейсхолдерами (:param)
     * @param array $params Параметры (массив)
     * @return array Результаты
     * @throws PDOException
     */
    public static function query($sql, $params = []) {
        $pdo = self::getInstance();
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Выполнить INSERT/UPDATE/DELETE и вернуть количество affected rows.
     * @param string $sql SQL с плейсхолдерами
     * @param array $params Параметры
     * @return int Количество измененных строк
     * @throws PDOException
     */
    public static function execute($sql, $params = []) {
        $pdo = self::getInstance();
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    /**
     * Выполнить запрос и вернуть один объект (fetchColumn для ID, etc.).
     * @param string $sql
     * @param array $params
     * @param int $columnNumber Колонка для возврата (0 по умолчанию)
     * @return mixed Значение
     */
    public static function fetchOne($sql, $params = [], $columnNumber = 0) {
        $pdo = self::getInstance();
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn($columnNumber);
    }

    /**
     * Закрыть соединение.
     */
    public static function close() {
        self::$instance = null;
    }
}
?>
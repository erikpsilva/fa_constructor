<?php

class Database {
    private static ?PDO $instance = null;

    public static function getInstance(): PDO {
        if (self::$instance === null) {
            try {
                self::$instance = new PDO(
                    'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                    DB_USER,
                    DB_PASS
                );
                self::$instance->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                self::$instance->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            } catch (PDOException $e) {
                http_response_code(500);
                header('Content-Type: application/json');
                die(json_encode(['success' => false, 'message' => 'Erro de conexão com o banco de dados.']));
            }
        }
        return self::$instance;
    }

    public static function query(string $sql, array $params = []): PDOStatement {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function fetch(string $sql, array $params = []): ?array {
        $result = self::query($sql, $params)->fetch();
        return $result ?: null;
    }

    public static function fetchAll(string $sql, array $params = []): array {
        return self::query($sql, $params)->fetchAll();
    }

    public static function insert(string $sql, array $params = []): string {
        self::query($sql, $params);
        return self::getInstance()->lastInsertId();
    }

    public static function execute(string $sql, array $params = []): int {
        return self::query($sql, $params)->rowCount();
    }
}

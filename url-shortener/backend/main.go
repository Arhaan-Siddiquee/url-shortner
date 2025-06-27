package main

import (
	"encoding/json"
	"fmt"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.etcd.io/bbolt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

var (
	db          *bbolt.DB
	baseURL     string
	statsBucket = []byte("stats")
)

func main() {
	initConfig()

	if err := initDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	r := setupRouter()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("Base URL: %s", baseURL)
	
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

type Config struct {
	BaseURL     string `json:"base_url"`
	DBPath      string `json:"db_path"`
	ShortLength int    `json:"short_length"`
}

func initConfig() {
	baseURL = os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}

	config := Config{
		BaseURL:     baseURL,
		DBPath:      "urls.db",
		ShortLength: 6,
	}
	
	if configFile, err := os.ReadFile("config.json"); err == nil {
		if err := json.Unmarshal(configFile, &config); err != nil {
			log.Printf("Error reading config file: %v. Using defaults", err)
		}
	}

	if envBaseURL := os.Getenv("BASE_URL"); envBaseURL != "" {
		baseURL = envBaseURL
	} else {
		baseURL = config.BaseURL
	}
}

func initDB() error {
	var err error
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "urls.db"
	}
	
	if dir := filepath.Dir(dbPath); dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create db directory: %v", err)
		}
	}
	
	db, err = bbolt.Open(dbPath, 0600, &bbolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		return err
	}

	return db.Update(func(tx *bbolt.Tx) error {
		if _, err := tx.CreateBucketIfNotExists([]byte("urls")); err != nil {
			return err
		}
		if _, err := tx.CreateBucketIfNotExists(statsBucket); err != nil {
			return err
		}
		return nil
	})
}

func setupRouter() *gin.Engine {
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}
	
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	r.Static("/static", "./frontend/build/static")
	r.StaticFile("/favicon.ico", "./frontend/build/favicon.ico")
	r.StaticFile("/manifest.json", "./frontend/build/manifest.json")

	api := r.Group("/api")
	{
		api.POST("/shorten", shortenURL)
		api.GET("/info/:short", getURLInfo)
	}

	admin := r.Group("/admin")
	{
		admin.GET("/stats", getStats)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "base_url": baseURL})
	})

	r.GET("/:short", func(c *gin.Context) {
		short := c.Param("short")
		
		if short == "static" || short == "api" || short == "admin" || short == "health" {
			c.Next()
			return
		}
		
		redirectURL(c)
	})

	r.NoRoute(func(c *gin.Context) {
		c.File("./frontend/build/index.html")
	})

	return r
}

type ShortenRequest struct {
	LongURL    string `json:"long_url" binding:"required,url"`
	CustomSlug string `json:"custom_slug,omitempty"`
}

type ShortenResponse struct {
	ShortURL string `json:"short_url"`
	LongURL  string `json:"long_url"`
}

type URLInfo struct {
	ShortURL    string    `json:"short_url"`
	LongURL     string    `json:"long_url"`
	CreatedAt   time.Time `json:"created_at"`
	AccessCount int       `json:"access_count"`
}

type StatsResponse struct {
	TotalURLs   int       `json:"total_urls"`
	TotalClicks int       `json:"total_clicks"`
	TopURLs     []URLInfo `json:"top_urls"`
}

func shortenURL(c *gin.Context) {
	var req ShortenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !isValidURL(req.LongURL) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid URL format"})
		return
	}

	short := req.CustomSlug
	if short == "" {
		short = generateShortCode()
	} else if !isValidSlug(short) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Custom slug must be alphanumeric"})
		return
	}

	var exists bool
	err := db.View(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket([]byte("urls"))
		existing := bucket.Get([]byte(short))
		exists = existing != nil
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Short URL already exists"})
		return
	}

	urlData, err := json.Marshal(struct {
		URL       string    `json:"url"`
		CreatedAt time.Time `json:"created_at"`
	}{
		URL:       req.LongURL,
		CreatedAt: time.Now(),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save URL"})
		return
	}

	err = db.Update(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket([]byte("urls"))
		if err := bucket.Put([]byte(short), urlData); err != nil {
			return err
		}

		stats := tx.Bucket(statsBucket)
		return stats.Put([]byte(short), []byte("0"))
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save URL"})
		return
	}

	c.JSON(http.StatusOK, ShortenResponse{
		ShortURL: fmt.Sprintf("%s/%s", baseURL, short),
		LongURL:  req.LongURL,
	})
}

func redirectURL(c *gin.Context) {
	short := c.Param("short")

	var urlData []byte
	err := db.View(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket([]byte("urls"))
		urlData = bucket.Get([]byte(short))
		return nil
	})
	if err != nil || len(urlData) == 0 {
		c.File("./frontend/build/index.html")
		return
	}

	go func() {
		if err := db.Update(func(tx *bbolt.Tx) error {
			stats := tx.Bucket(statsBucket)
			count := stats.Get([]byte(short))
			var cnt int
			if count != nil {
				cnt = btoi(count) + 1
			} else {
				cnt = 1
			}
			return stats.Put([]byte(short), itob(cnt))
		}); err != nil {
			log.Printf("Failed to update stats: %v", err)
		}
	}()

	var urlInfo struct {
		URL       string    `json:"url"`
		CreatedAt time.Time `json:"created_at"`
	}
	if err := json.Unmarshal(urlData, &urlInfo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid URL data"})
		return
	}

	c.Redirect(http.StatusMovedPermanently, urlInfo.URL)
}

func getURLInfo(c *gin.Context) {
	short := c.Param("short")

	var urlData []byte
	var accessCount int
	err := db.View(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket([]byte("urls"))
		urlData = bucket.Get([]byte(short))
		if urlData == nil {
			return nil
		}

		stats := tx.Bucket(statsBucket)
		count := stats.Get([]byte(short))
		if count != nil {
			accessCount = btoi(count)
		}
		return nil
	})
	if err != nil || len(urlData) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "URL not found"})
		return
	}

	var urlInfo struct {
		URL       string    `json:"url"`
		CreatedAt time.Time `json:"created_at"`
	}
	if err := json.Unmarshal(urlData, &urlInfo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid URL data"})
		return
	}

	c.JSON(http.StatusOK, URLInfo{
		ShortURL:    fmt.Sprintf("%s/%s", baseURL, short),
		LongURL:     urlInfo.URL,
		CreatedAt:   urlInfo.CreatedAt,
		AccessCount: accessCount,
	})
}

func getStats(c *gin.Context) {
	var stats StatsResponse

	err := db.View(func(tx *bbolt.Tx) error {
		urls := tx.Bucket([]byte("urls"))
		statsBucket := tx.Bucket(statsBucket)

		cursor := urls.Cursor()
		for k, v := cursor.First(); k != nil; k, v = cursor.Next() {
			stats.TotalURLs++

			var urlInfo struct {
				URL       string    `json:"url"`
				CreatedAt time.Time `json:"created_at"`
			}
			if err := json.Unmarshal(v, &urlInfo); err != nil {
				continue
			}

			count := statsBucket.Get(k)
			var accessCount int
			if count != nil {
				accessCount = btoi(count)
			}
			stats.TotalClicks += accessCount

			if len(stats.TopURLs) < 5 || accessCount > stats.TopURLs[4].AccessCount {
				url := URLInfo{
					ShortURL:    fmt.Sprintf("%s/%s", baseURL, k),
					LongURL:     urlInfo.URL,
					CreatedAt:   urlInfo.CreatedAt,
					AccessCount: accessCount,
				}

				inserted := false
				for i := range stats.TopURLs {
					if accessCount > stats.TopURLs[i].AccessCount {
						stats.TopURLs = append(
							stats.TopURLs[:i],
							append([]URLInfo{url}, stats.TopURLs[i:]...)...,
						)
						inserted = true
						break
					}
				}
				if !inserted && len(stats.TopURLs) < 5 {
					stats.TopURLs = append(stats.TopURLs, url)
				}

				if len(stats.TopURLs) > 5 {
					stats.TopURLs = stats.TopURLs[:5]
				}
			}
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func generateShortCode() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	rand.Seed(time.Now().UnixNano())
	short := make([]byte, 6)
	for i := range short {
		short[i] = charset[rand.Intn(len(charset))]
	}
	return string(short)
}

func isValidURL(url string) bool {
	return len(url) > 10 && (url[:7] == "http://" || url[:8] == "https://")
}

func isValidSlug(slug string) bool {
	for _, c := range slug {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
			return false
		}
	}
	return true
}

func btoi(b []byte) int {
	var n int
	for _, c := range b {
		n = n*10 + int(c-'0')
	}
	return n
}

func itob(n int) []byte {
	if n == 0 {
		return []byte("0")
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte(n%10 + '0')}, b...)
		n /= 10
	}
	return b
}
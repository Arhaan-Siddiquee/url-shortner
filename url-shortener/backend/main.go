package main

import (
	"github.com/gin-gonic/gin"
	"go.etcd.io/bbolt"
	"log"
	"net/http"
	"math/rand"
	"time"
)

var db *bbolt.DB

func main() {
	var err error
	db, err = bbolt.Open("urls.db", 0600, nil)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	err = db.Update(func(tx *bbolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists([]byte("urls"))
		return err
	})
	if err != nil {
		log.Fatal(err)
	}

	r := gin.Default()

	r.POST("/shorten", shortenURL)
	r.GET("/:short", redirectURL)

	r.Run(":8080")
}

type ShortenRequest struct {
	LongURL string `json:"long_url"`
}

type ShortenResponse struct {
	ShortURL string `json:"short_url"`
}

func shortenURL(c *gin.Context) {
	var req ShortenRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	short := generateShortCode()

	err := db.Update(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket([]byte("urls"))
		return bucket.Put([]byte(short), []byte(req.LongURL))
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save URL"})
		return
	}

	c.JSON(http.StatusOK, ShortenResponse{
		ShortURL: "http://localhost:8080/" + short,
	})
}

func redirectURL(c *gin.Context) {
	short := c.Param("short")

	var longURL string
	err := db.View(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket([]byte("urls"))
		longURL = string(bucket.Get([]byte(short)))
		return nil
	})
	if err != nil || longURL == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "URL not found"})
		return
	}

	c.Redirect(http.StatusMovedPermanently, longURL)
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
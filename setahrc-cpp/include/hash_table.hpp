#ifndef SETA_HASH_TABLE_HPP
#define SETA_HASH_TABLE_HPP

#include <iostream>
#include <string>
#include <vector>
#include <stdexcept>

namespace seta {

/**
 * Custom Hash Table Implementation using Separate Chaining (Linked Lists).
 * Designed to demonstrate core Data Structure concepts:
 * - Hash functions (Polynomial rolling hash)
 * - Collision resolution via chaining
 * - Dynamic rehashing and load factor management
 * - Average Time Complexity: O(1) Search, Insert, and Delete
 */
template <typename K, typename V>
class HashTable {
private:
    struct HashNode {
        K key;
        V value;
        HashNode* next;

        HashNode(const K& k, const V& v) : key(k), value(v), next(nullptr) {}
    };

    std::vector<HashNode*> buckets;
    size_t capacity;
    size_t num_elements;
    const double max_load_factor = 0.75;

    // Polynomial rolling hash function for strings
    size_t hashFunction(const std::string& key) const {
        size_t hash = 0;
        const size_t p = 31;
        const size_t m = 1e9 + 9;
        size_t p_pow = 1;
        for (char c : key) {
            hash = (hash + (c - 'a' + 1) * p_pow) % m;
            p_pow = (p_pow * p) % m;
        }
        return hash % capacity;
    }

    // Overload for integer keys
    size_t hashFunction(int key) const {
        return (static_cast<size_t>(key) * 2654435761u) % capacity;
    }

    void rehash() {
        size_t old_capacity = capacity;
        std::vector<HashNode*> old_buckets = buckets;

        capacity *= 2;
        buckets.assign(capacity, nullptr);
        num_elements = 0;

        for (size_t i = 0; i < old_capacity; ++i) {
            HashNode* curr = old_buckets[i];
            while (curr != nullptr) {
                insert(curr->key, curr->value);
                HashNode* prev = curr;
                curr = curr->next;
                delete prev;
            }
        }
    }

public:
    explicit HashTable(size_t initial_capacity = 31)
        : capacity(initial_capacity), num_elements(0) {
        buckets.assign(capacity, nullptr);
    }

    ~HashTable() {
        clear();
    }

    void clear() {
        for (size_t i = 0; i < capacity; ++i) {
            HashNode* curr = buckets[i];
            while (curr != nullptr) {
                HashNode* prev = curr;
                curr = curr->next;
                delete prev;
            }
            buckets[i] = nullptr;
        }
        num_elements = 0;
    }

    void insert(const K& key, const V& value) {
        if (static_cast<double>(num_elements + 1) / capacity > max_load_factor) {
            rehash();
        }

        size_t idx = hashFunction(key);
        HashNode* curr = buckets[idx];

        // Check if key already exists, update value
        while (curr != nullptr) {
            if (curr->key == key) {
                curr->value = value;
                return;
            }
            curr = curr->next;
        }

        // Insert at beginning of bucket chain
        HashNode* newNode = new HashNode(key, value);
        newNode->next = buckets[idx];
        buckets[idx] = newNode;
        num_elements++;
    }

    V* find(const K& key) {
        size_t idx = hashFunction(key);
        HashNode* curr = buckets[idx];
        while (curr != nullptr) {
            if (curr->key == key) {
                return &(curr->value);
            }
            curr = curr->next;
        }
        return nullptr;
    }

    const V* find(const K& key) const {
        size_t idx = hashFunction(key);
        HashNode* curr = buckets[idx];
        while (curr != nullptr) {
            if (curr->key == key) {
                return &(curr->value);
            }
            curr = curr->next;
        }
        return nullptr;
    }

    bool contains(const K& key) const {
        return find(key) != nullptr;
    }

    bool remove(const K& key) {
        size_t idx = hashFunction(key);
        HashNode* curr = buckets[idx];
        HashNode* prev = nullptr;

        while (curr != nullptr) {
            if (curr->key == key) {
                if (prev == nullptr) {
                    buckets[idx] = curr->next;
                } else {
                    prev->next = curr->next;
                }
                delete curr;
                num_elements--;
                return true;
            }
            prev = curr;
            curr = curr->next;
        }
        return false;
    }

    size_t size() const { return num_elements; }
    bool empty() const { return num_elements == 0; }

    std::vector<V> getAllValues() const {
        std::vector<V> values;
        values.reserve(num_elements);
        for (size_t i = 0; i < capacity; ++i) {
            HashNode* curr = buckets[i];
            while (curr != nullptr) {
                values.push_back(curr->value);
                curr = curr->next;
            }
        }
        return values;
    }
};

} // namespace seta

#endif // SETA_HASH_TABLE_HPP

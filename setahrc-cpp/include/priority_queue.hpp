#ifndef SETA_PRIORITY_QUEUE_HPP
#define SETA_PRIORITY_QUEUE_HPP

#include <vector>
#include <stdexcept>
#include <algorithm>

namespace seta {

/**
 * Custom Binary Max-Heap for Emergency Triage Priority Queue.
 * Time Complexity:
 * - push(): O(log N)
 * - pop(): O(log N)
 * - top(): O(1)
 * Ensures highest-priority (most critical) patients are addressed first.
 */
template <typename T, typename Comparator>
class PriorityQueue {
private:
    std::vector<T> heap;
    Comparator comp; // returns true if first argument has LOWER priority than second (for max-heap)

    void heapifyUp(size_t index) {
        while (index > 0) {
            size_t parent = (index - 1) / 2;
            if (comp(heap[parent], heap[index])) {
                std::swap(heap[parent], heap[index]);
                index = parent;
            } else {
                break;
            }
        }
    }

    void heapifyDown(size_t index) {
        size_t size = heap.size();
        while (true) {
            size_t left = 2 * index + 1;
            size_t right = 2 * index + 2;
            size_t largest = index;

            if (left < size && comp(heap[largest], heap[left])) {
                largest = left;
            }
            if (right < size && comp(heap[largest], heap[right])) {
                largest = right;
            }

            if (largest != index) {
                std::swap(heap[index], heap[largest]);
                index = largest;
            } else {
                break;
            }
        }
    }

public:
    PriorityQueue() = default;

    void push(const T& item) {
        heap.push_back(item);
        heapifyUp(heap.size() - 1);
    }

    void pop() {
        if (heap.empty()) {
            throw std::out_of_range("Priority queue is empty");
        }
        heap[0] = heap.back();
        heap.pop_back();
        if (!heap.empty()) {
            heapifyDown(0);
        }
    }

    const T& top() const {
        if (heap.empty()) {
            throw std::out_of_range("Priority queue is empty");
        }
        return heap[0];
    }

    size_t size() const { return heap.size(); }
    bool empty() const { return heap.empty(); }

    void clear() { heap.clear(); }

    // Returns a copy of all elements sorted from highest to lowest priority
    std::vector<T> getSortedElements() const {
        std::vector<T> sorted = heap;
        std::sort(sorted.begin(), sorted.end(), [this](const T& a, const T& b) {
            return !comp(a, b);
        });
        return sorted;
    }
};

} // namespace seta

#endif // SETA_PRIORITY_QUEUE_HPP
